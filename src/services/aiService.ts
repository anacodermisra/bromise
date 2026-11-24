import type { Category, Task, AIConfig } from '../types';
import {
  getTasks,
  getDailyPlans,
  cleanPrefilledTasks,
  formatDateKey,
  getGymSchedule,
  getStudyBooks,
  getCategories,
} from '../utils/storage';
import {
  syncAddTask,
  syncUpdateTask,
  syncDeleteTask,
  syncAddToToday,
  syncRemoveFromToday,
  syncToggleCompletion,
  isTaskCompletedOnDate,
  syncAddCategory,
} from './syncAdapter';

const AI_CONFIG_KEY = 'bromise_ai_config';

export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: true,
  provider: 'gemini',
  endpointUrl: 'https://generativelanguage.googleapis.com/v1beta',
  model: 'gemini-3.6-flash',
  geminiModel: 'gemini-3.6-flash',
  apiKey: '',
  autoExecuteActions: true,
};

export function getStoredAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migrate legacy deprecated models (1.5-flash, 1.5-pro, 2.0-flash, 3.5-flash)
      if (
        !parsed.geminiModel ||
        parsed.geminiModel.startsWith('gemini-1.5') ||
        parsed.geminiModel === 'gemini-2.0-flash' ||
        parsed.geminiModel === 'gemini-3.5-flash'
      ) {
        parsed.geminiModel = 'gemini-3.6-flash';
      }
      return { ...DEFAULT_AI_CONFIG, ...parsed };
    }
  } catch {}
  return DEFAULT_AI_CONFIG;
}

export function saveStoredAIConfig(config: AIConfig) {
  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('bromise-ai-config-change'));
  } catch (e) {
    console.error('Failed to save AI config:', e);
  }
}

export interface ActiveModelInfo {
  providerName: string;
  modelName: string;
  isCloud: boolean;
  statusText: string;
}

export function getActiveAIModelInfo(config = getStoredAIConfig()): ActiveModelInfo {
  if (config.provider === 'gemini') {
    if (config.apiKey && config.apiKey.trim().length > 0) {
      return {
        providerName: 'Google Gemini',
        modelName: config.geminiModel || 'gemini-3.6-flash',
        isCloud: true,
        statusText: `Cloud LLM Active (${config.geminiModel || 'gemini-3.6-flash'})`,
      };
    }
    return {
      providerName: 'Google Gemini (Key Required)',
      modelName: 'Offline Fallback Active',
      isCloud: false,
      statusText: 'Paste Gemini API Key for Natural Language AI',
    };
  }

  if (config.provider === 'ollama') {
    return {
      providerName: 'Ollama (Local)',
      modelName: config.model || 'llama3.2',
      isCloud: false,
      statusText: `Local LLM: ${config.model || 'llama3.2'}`,
    };
  }

  if (config.provider === 'lmstudio') {
    return {
      providerName: 'LM Studio / LocalAI',
      modelName: config.model || 'local-model',
      isCloud: false,
      statusText: `Local Server: ${config.model || 'local-model'}`,
    };
  }

  return {
    providerName: 'Tactical Heuristics',
    modelName: 'Local NLP Command Parser',
    isCloud: false,
    statusText: 'Offline Command Parser Active',
  };
}

export interface BroActionResult {
  reply: string;
  actionTaken?:
    | 'completed_task'
    | 'uncompleted_task'
    | 'deleted_task'
    | 'rescheduled_task'
    | 'cleared_completed'
    | 'added_task'
    | 'deleted_prefilled'
    | 'scheduled_today'
    | 'daily_brief'
    | 'gym_info'
    | 'study_info'
    | 'task_not_found'
    | 'ai_temporarily_unavailable';
  details?: string;
  success: boolean;
}

/**
 * Smart fuzzy matching to locate an active task by title, substring, or keywords
 */
export function findMatchingTask(targetQuery: string, tasks = getTasks()): Task | null {
  const activeTasks = tasks.filter(t => !t.archivedAt);
  if (activeTasks.length === 0) return null;

  const clean = targetQuery.trim().toLowerCase();
  if (!clean) return null;

  // 1. Exact match (case-insensitive)
  const exact = activeTasks.find(t => t.title.toLowerCase() === clean);
  if (exact) return exact;

  // 2. Substring match (either task contains query or query contains task title)
  const sub = activeTasks.find(
    t => t.title.toLowerCase().includes(clean) || clean.includes(t.title.toLowerCase())
  );
  if (sub) return sub;

  // 3. Keyword / Token overlap match (filtering out common filler words)
  const stopWords = new Set([
    'task', 'the', 'my', 'a', 'an', 'for', 'to', 'in', 'and', 'from',
    'done', 'today', 'tomorrow', 'please', 'can', 'you', 'bro', 'bot',
  ]);
  const tokens = clean
    .split(/[\s,.:;!?'"-]+/)
    .map(t => t.trim())
    .filter(t => t.length > 2 && !stopWords.has(t));

  if (tokens.length > 0) {
    let bestTask: Task | null = null;
    let maxMatches = 0;

    for (const t of activeTasks) {
      const titleLower = t.title.toLowerCase();
      let matches = 0;
      for (const tok of tokens) {
        if (titleLower.includes(tok)) matches++;
      }
      if (matches > maxMatches) {
        maxMatches = matches;
        bestTask = t;
      }
    }

    if (maxMatches > 0) {
      return bestTask;
    }
  }

  return null;
}

/**
 * Checks connection to Google Gemini API
 */
export async function testGeminiConnection(
  apiKey: string,
  model = 'gemini-3.6-flash'
): Promise<{ ok: boolean; message: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { ok: false, message: 'Please enter a Gemini API Key from Google AI Studio.' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with the single word "READY".' }] }],
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      return {
        ok: true,
        message: `Connected to Google Gemini (${model})! Ready for conversational intelligence.`,
      };
    }

    const errData = await res.json().catch(() => ({}));
    const message = errData?.error?.message || res.statusText || `HTTP ${res.status}`;
    return { ok: false, message: `Gemini API returned error: ${message}` };
  } catch (err: any) {
    return { ok: false, message: `Failed to connect to Gemini: ${err.message}` };
  }
}

/**
 * Checks connection to local Ollama or LM Studio
 */
export async function testLocalAIConnection(
  config: AIConfig
): Promise<{ ok: boolean; message: string; models?: string[] }> {
  try {
    if (config.provider === 'gemini') {
      const res = await testGeminiConnection(config.apiKey || '', config.geminiModel || 'gemini-3.6-flash');
      return { ok: res.ok, message: res.message };
    }

    if (config.provider === 'ollama') {
      const url = `${config.endpointUrl.replace(/\/$/, '')}/api/tags`;
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name);
        return {
          ok: true,
          message: `Connected to Ollama! Found ${models.length} model(s): ${models.join(', ')}`,
          models,
        };
      }
      return { ok: false, message: `Ollama replied with status ${res.status}` };
    }

    if (config.provider === 'lmstudio') {
      const url = `${config.endpointUrl.replace(/\/$/, '')}/v1/models`;
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const models = (data.data || []).map((m: any) => m.id);
        return {
          ok: true,
          message: `Connected to LM Studio / LocalAI! Models: ${models.join(', ')}`,
          models,
        };
      }
      return { ok: false, message: `LM Studio replied with status ${res.status}` };
    }

    return { ok: true, message: 'Offline command parser active (no external connection needed).' };
  } catch (err: any) {
    return {
      ok: false,
      message: `Could not reach ${config.endpointUrl || 'provider'}: ${err.message}`,
    };
  }
}

/**
 * Helper to compute date string from user expression like 'today', 'tomorrow', '2026-11-25', or weekday
 */
export function resolveDateFromExpression(expr: string, selectedDate: string): string {
  const clean = expr.trim().toLowerCase();
  const today = new Date();

  if (clean === 'today') {
    return formatDateKey(today);
  }

  if (clean === 'tomorrow') {
    const tmrw = new Date(today);
    tmrw.setDate(tmrw.getDate() + 1);
    return formatDateKey(tmrw);
  }

  // Check YYYY-MM-DD
  const ymdMatch = clean.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (ymdMatch) return ymdMatch[0];

  // Check weekday name (mon, tue, wed, etc.)
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = weekdays.findIndex(d => clean.includes(d));
  if (dayIndex !== -1) {
    const target = new Date(today);
    const currentDay = today.getDay();
    let diff = dayIndex - currentDay;
    if (diff <= 0) diff += 7; // Next occurrence
    target.setDate(today.getDate() + diff);
    return formatDateKey(target);
  }

  return selectedDate || formatDateKey(today);
}

/**
 * Matches category from input text or returns / creates match
 */
export async function resolveCategory(
  categoryQuery: string | undefined,
  passedCategories: Category[]
): Promise<{ id: string; name: string }> {
  const categories = passedCategories && passedCategories.length > 0 ? passedCategories : getCategories();

  if (!categoryQuery || !categoryQuery.trim()) {
    if (categories && categories.length > 0) {
      return { id: categories[0].id, name: categories[0].name };
    }
    return { id: 'cat-general', name: 'General' };
  }

  const queryClean = categoryQuery.trim().toLowerCase();

  // 1. Exact match
  const exact = categories.find(c => c.name.toLowerCase() === queryClean);
  if (exact) return { id: exact.id, name: exact.name };

  // 2. Substring match
  const partial = categories.find(
    c => c.name.toLowerCase().includes(queryClean) || queryClean.includes(c.name.toLowerCase())
  );
  if (partial) return { id: partial.id, name: partial.name };

  // 3. Auto-create named category so user request is honored directly
  try {
    const rawName = categoryQuery.trim();
    const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const newCat = await syncAddCategory({
      name: formattedName,
      icon: 'Folder',
      accent: '#38bdf8',
    });
    return { id: newCat.id, name: newCat.name };
  } catch {
    if (categories && categories.length > 0) {
      return { id: categories[0].id, name: categories[0].name };
    }
    return { id: 'cat-general', name: categoryQuery.trim() };
  }
}

/**
 * Main command execution entrypoint:
 * Understands both human natural language (via Gemini LLM) and deterministic direct commands.
 */
export async function executeBroCommand(
  input: string,
  categories: Category[],
  selectedDate: string
): Promise<BroActionResult> {
  const query = input.trim();
  const lower = query.toLowerCase();
  const config = getStoredAIConfig();

  // ─────────────────────────────────────────────────────────────
  // 1. Check for quick direct deterministic commands first
  // ─────────────────────────────────────────────────────────────

  // Help / Commands Guide
  if (
    lower === 'help' ||
    lower === 'commands' ||
    lower === 'what can you do' ||
    lower === 'how to use' ||
    lower === 'options'
  ) {
    return {
      reply: `**Bro Bot Command Center & Intelligence:**

You can speak in **natural English** or use fast direct commands:

• **Add Task:** \`add task [title] in [category] assign today\`
• **Remove Task:** \`remove task [title]\` or \`delete [title]\`
• **Mark Done:** \`mark task [title] as done\` or \`complete [title]\`
• **Unmark Task:** \`unmark task [title]\` or \`reopen [title]\`
• **Reschedule:** \`reschedule task [title] to tomorrow\` (or to any date)
• **Clear Finished:** \`clear completed\`
• **List Targets:** \`list tasks\`
• **Daily Briefing:** \`Daily battle plan\`
• **Workout Info:** \`Today's gym split\`

*Tip: Connect your free Google Gemini API key in drawer Config to speak freely in everyday conversation!*`,
      success: true,
    };
  }

  // Clean / Delete sample prefilled tasks
  if (
    lower.includes('delete prefilled') ||
    lower.includes('delete sample') ||
    lower.includes('clean sample') ||
    lower.includes('clean backlog') ||
    lower.includes('delete default task')
  ) {
    const count = cleanPrefilledTasks();
    if (count > 0) {
      return {
        reply: `Cleaned out **${count}** sample task(s). Your backlog now contains only your real targets!`,
        actionTaken: 'deleted_prefilled',
        details: `Removed ${count} sample items`,
        success: true,
      };
    }
    return {
      reply: "All prefilled sample tasks have already been cleared. You're running lean and focused, Bro!",
      actionTaken: 'deleted_prefilled',
      success: true,
    };
  }

  // Clear completed tasks from selected date
  if (
    lower === 'clear completed' ||
    lower === 'clear done' ||
    lower === 'clear finished' ||
    lower === 'clean completed' ||
    lower === 'clean done'
  ) {
    const plans = getDailyPlans().filter(p => p.date === selectedDate);
    const completedTaskIds = plans
      .map(p => p.taskId)
      .filter(id => isTaskCompletedOnDate(id, selectedDate));

    if (completedTaskIds.length === 0) {
      return {
        reply: `There are no completed tasks to clear on **${selectedDate}**. All active targets are in play!`,
        actionTaken: 'cleared_completed',
        success: true,
      };
    }

    for (const taskId of completedTaskIds) {
      await syncRemoveFromToday(taskId, selectedDate);
    }

    return {
      reply: `Cleared **${completedTaskIds.length}** completed task(s) from **${selectedDate}**'s daily view. Fresh battlefield!`,
      actionTaken: 'cleared_completed',
      details: `Cleared ${completedTaskIds.length} tasks`,
      success: true,
    };
  }

  // Daily Battle Plan / Briefing
  if (
    lower.includes('status') ||
    lower.includes('battle plan') ||
    lower.includes('brief') ||
    lower.includes('how am i doing') ||
    lower.includes('summary')
  ) {
    const tasks = getTasks().filter(t => !t.archivedAt);
    const plans = getDailyPlans().filter(p => p.date === selectedDate);
    const validTasks = tasks.filter(t => plans.some(p => p.taskId === t.id));
    const completedTasks = validTasks.filter(t => isTaskCompletedOnDate(t.id, selectedDate));

    const total = validTasks.length;
    const completed = completedTasks.length;
    const remaining = total - completed;

    let morale = 'Keep attacking the day!';
    if (completed === total && total > 0) morale = '100% daily execution conquered! Elite discipline.';
    else if (completed > 0) morale = 'Good momentum, finish the remaining targets!';

    return {
      reply: `**Daily Battle Brief (${selectedDate}):**\n• Scheduled Targets: **${total}**\n• Completed: **${completed}**\n• Remaining: **${remaining}**\n\n*${morale} Do it for your younger self.*`,
      actionTaken: 'daily_brief',
      success: true,
    };
  }

  // List / Show Tasks
  if (
    /^(?:list\s+tasks|show\s+tasks|view\s+tasks|my\s+tasks|all\s+tasks|what\s+are\s+my\s+tasks)\b/i.test(query)
  ) {
    const tasks = getTasks().filter(t => !t.archivedAt);
    const plans = getDailyPlans().filter(p => p.date === selectedDate);
    const scheduled = tasks.filter(t => plans.some(p => p.taskId === t.id));

    if (scheduled.length === 0) {
      return {
        reply: `No tasks scheduled on **${selectedDate}** yet. You have **${tasks.length}** task(s) in backlog.\n\nType \`add task [title] in [category] assign today\` to lock one in!`,
        success: true,
      };
    }

    const items = scheduled
      .map(t => {
        const done = isTaskCompletedOnDate(t.id, selectedDate);
        return `${done ? '✅' : '⏳'} **${t.title}** ${done ? '*(Done)*' : '*(Pending)*'}`;
      })
      .join('\n');

    return {
      reply: `**Scheduled Targets for ${selectedDate}:**\n\n${items}\n\n*Execute with precision!*`,
      success: true,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Unmark Task Command (Reopen / Undo / Mark pending)
  // Must run BEFORE mark task to prevent greedy match
  // ─────────────────────────────────────────────────────────────
  const isUnmarkCommand =
    /^(?:unmark\s+task|unmark|reopen\s+task|reopen|undo\s+task|undo)\b/i.test(query) ||
    /^(?:mark\s+task|mark)\s+.+?\s+(?:as\s+pending|as\s+undone|as\s+incomplete|undone|pending|incomplete)$/i.test(query);

  if (isUnmarkCommand) {
    let rawTarget = query
      .replace(/^(?:unmark\s+task|unmark|reopen\s+task|reopen|undo\s+task|undo)\s+/i, '')
      .replace(/^(?:mark\s+task|mark)\s+/i, '')
      .replace(/\s+(?:as\s+pending|as\s+undone|as\s+incomplete|undone|pending|incomplete)$/i, '')
      .trim();

    rawTarget = rawTarget.replace(/^["']|["']$/g, '').trim();

    const match = findMatchingTask(rawTarget);
    if (match) {
      const isDone = isTaskCompletedOnDate(match.id, selectedDate);
      if (isDone) {
        await syncToggleCompletion(match.id, selectedDate);
      }
      return {
        reply: `Unmarked **"${match.title}"** — status set back to pending for **${selectedDate}**. Back on the frontline!`,
        actionTaken: 'uncompleted_task',
        details: `Task: ${match.title}`,
        success: true,
      };
    }

    const activeSample = getTasks().filter(t => !t.archivedAt).slice(0, 3).map(t => `"${t.title}"`).join(', ');
    return {
      reply: `Bro, I searched your tasks but couldn't find one matching **"${rawTarget}"** to unmark.${
        activeSample ? ` Existing tasks include: ${activeSample}` : ''
      }`,
      actionTaken: 'task_not_found',
      success: false,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Remove / Delete Task Command
  // ─────────────────────────────────────────────────────────────
  const isRemoveCommand =
    /^(?:remove\s+task|delete\s+task|archive\s+task|drop\s+task|remove|delete|archive|drop)\b/i.test(query);

  if (isRemoveCommand) {
    let rawTarget = query
      .replace(/^(?:remove\s+task|delete\s+task|archive\s+task|drop\s+task|remove|delete|archive|drop)\s+/i, '')
      .trim();
    rawTarget = rawTarget.replace(/^["']|["']$/g, '').trim();

    const match = findMatchingTask(rawTarget);
    if (match) {
      await syncDeleteTask(match.id);
      await syncRemoveFromToday(match.id, selectedDate);

      return {
        reply: `Deleted task **"${match.title}"** from your targets and schedule. Kept your focus sharp!`,
        actionTaken: 'deleted_task',
        details: `Task: ${match.title}`,
        success: true,
      };
    }

    const activeSample = getTasks().filter(t => !t.archivedAt).slice(0, 3).map(t => `"${t.title}"`).join(', ');
    return {
      reply: `Bro, I couldn't find an active task matching **"${rawTarget}"** to delete.${
        activeSample ? ` Available tasks: ${activeSample}` : ''
      }`,
      actionTaken: 'task_not_found',
      success: false,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Reschedule / Move Task Command
  // e.g. "reschedule task DSA Trees to tomorrow", "move Chest workout to 2026-11-26"
  // ─────────────────────────────────────────────────────────────
  const isRescheduleCommand =
    /^(?:reschedule\s+task|reschedule|move\s+task|move|postpone\s+task|postpone|shift\s+task|shift)\b/i.test(query);

  if (isRescheduleCommand) {
    const stripped = query
      .replace(/^(?:reschedule\s+task|reschedule|move\s+task|move|postpone\s+task|postpone|shift\s+task|shift)\s+/i, '')
      .trim();

    const toMatch = stripped.match(
      /(.+?)\s+(?:to|for)\s+(today|tomorrow|\d{4}-\d{2}-\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
    );

    if (toMatch) {
      const rawTitle = toMatch[1].replace(/^task\s+/i, '').replace(/^["']|["']$/g, '').trim();
      const targetDateExpr = toMatch[2];
      const targetDate = resolveDateFromExpression(targetDateExpr, selectedDate);

      const match = findMatchingTask(rawTitle);
      if (match) {
        // Remove from current date plan
        await syncRemoveFromToday(match.id, selectedDate);
        // Update task deadline
        await syncUpdateTask(match.id, { deadline: targetDate });
        // Add to new date plan
        await syncAddToToday(match.id, targetDate);

        return {
          reply: `Rescheduled **"${match.title}"** to **${targetDate}**. The battle plan is locked in!`,
          actionTaken: 'rescheduled_task',
          details: `Moved ${match.title} to ${targetDate}`,
          success: true,
        };
      }

      return {
        reply: `Could not find a task matching **"${rawTitle}"** to reschedule. Check your task titles and try again!`,
        actionTaken: 'task_not_found',
        success: false,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Direct Task Addition Command
  // ─────────────────────────────────────────────────────────────
  const isAddCommand = /^(?:add\s+task|create\s+task|schedule\s+task|new\s+task|add)\b/i.test(query);
  if (isAddCommand) {
    return await parseAndExecuteAddCommand(query, categories, selectedDate);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Mark Task Done Command
  // ─────────────────────────────────────────────────────────────
  const isMarkDoneCommand =
    /^(?:mark\s+task|complete\s+task|finish\s+task|check\s+off\s+task|mark|complete|done\s+with|done|finish|check\s+off)\b/i.test(
      query
    );

  if (isMarkDoneCommand) {
    let rawTarget = query
      .replace(
        /^(?:mark\s+task|complete\s+task|finish\s+task|check\s+off\s+task|mark|complete|done\s+with|done|finish|check\s+off)\s+/i,
        ''
      )
      .replace(/\s+(?:as\s+done|as\s+completed|done|completed)$/i, '')
      .trim();
    rawTarget = rawTarget.replace(/^["']|["']$/g, '').trim();

    const match = findMatchingTask(rawTarget);
    if (match) {
      const isDone = isTaskCompletedOnDate(match.id, selectedDate);
      if (!isDone) {
        await syncToggleCompletion(match.id, selectedDate);
      }

      // Also ensure it is present on selectedDate's daily plan
      const plans = getDailyPlans().filter(p => p.date === selectedDate);
      if (!plans.some(p => p.taskId === match.id)) {
        await syncAddToToday(match.id, selectedDate);
      }

      return {
        reply: `Marked **"${match.title}"** as completed for **${selectedDate}**! Keep the discipline unbroken.`,
        actionTaken: 'completed_task',
        details: `Task: ${match.title}`,
        success: true,
      };
    }

    const activeSample = getTasks().filter(t => !t.archivedAt).slice(0, 3).map(t => `"${t.title}"`).join(', ');
    return {
      reply: `Bro, I searched your tasks but couldn't find one matching **"${rawTarget}"**.${
        activeSample ? ` Try matching one of these: ${activeSample}` : ''
      }`,
      actionTaken: 'task_not_found',
      success: false,
    };
  }

  // Gym Room Split Query
  if (lower.includes('gym') || lower.includes('workout') || lower.includes('exercise split')) {
    const gym = getGymSchedule();
    const dayKey = lower.includes('mon')
      ? 'mon'
      : lower.includes('tue')
      ? 'tue'
      : lower.includes('wed')
      ? 'wed'
      : lower.includes('thu')
      ? 'thu'
      : lower.includes('fri')
      ? 'fri'
      : lower.includes('sat')
      ? 'sat'
      : lower.includes('sun')
      ? 'sun'
      : 'mon';
    const split = gym[dayKey];
    if (split) {
      const exList =
        split.exercises.length > 0
          ? split.exercises.map(e => `• ${e.name} (${e.defaultSets}×${e.defaultReps})`).join('\n')
          : '• *No exercises logged yet for this split. Add exercises in the Gym Room!*';

      return {
        reply: `**${split.dayName}: ${split.title}**\n\n${exList}\n\n*Check the Gym Room to see your anatomical muscle map!*`,
        actionTaken: 'gym_info',
        success: true,
      };
    }
  }

  // Study Room Bookshelf Query
  if (
    lower.includes('study') &&
    (lower.includes('shelf') || lower.includes('books') || lower.includes('subjects') || lower.includes('courses'))
  ) {
    const books = getStudyBooks();
    if (books.length === 0) {
      return {
        reply: "Your Study Room shelves are currently clean! You can add Academic Subjects, Courses, or Reading Books directly in the Study Room.",
        actionTaken: 'study_info',
        success: true,
      };
    }
    const bookList = books
      .map(b => `• **${b.code}**: ${b.title} (${b.chapters.length} chapters, shelf: ${b.shelf || 'subjects'})`)
      .join('\n');
    return {
      reply: `**Study Room Curriculum (${books.length} items logged):**\n\n${bookList}`,
      actionTaken: 'study_info',
      success: true,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 7. Google Gemini Cloud LLM (Conversational Human Context Understanding)
  // ─────────────────────────────────────────────────────────────
  if (config.provider === 'gemini' && config.apiKey && config.apiKey.trim().length > 0) {
    try {
      const geminiResult = await callGeminiLLM(query, categories, selectedDate, config);
      if (geminiResult) return geminiResult;
      // Gemini returned null — temporarily unavailable after all retries
      return {
        reply: `**Gemini is temporarily overloaded.** Try again in a moment, or switch models in Config!\n\nQuick offline commands:\n• **add task [title] in [category]**\n• **mark task [title] as done**\n• **remove task [title]**\n• **clear completed**`,
        actionTaken: 'ai_temporarily_unavailable',
        success: false,
      };
    } catch (e: any) {
      console.warn('Gemini call failed:', e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 8. Local Ollama LLM (if configured)
  // ─────────────────────────────────────────────────────────────
  if (config.provider === 'ollama' && config.endpointUrl) {
    try {
      const ollamaResult = await callOllamaLLM(query, categories, selectedDate, config);
      if (ollamaResult) return ollamaResult;
    } catch (e) {
      console.warn('Ollama call failed:', e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 9. Default Fallback (when Gemini unavailable)
  // ─────────────────────────────────────────────────────────────
  return {
    reply: `Here are quick task commands you can use:

• **add task [title] in [category] assign today**
• **remove task [title]**
• **mark task [title] as done**
• **unmark task [title]**
• **reschedule task [title] to tomorrow**
• **clear completed**

Tip: Connect your Google Gemini API key in Config to speak freely in natural conversation.`,
    success: true,
  };
}

/**
 * Robust local parser for "add task [title] in [category] assign [date/today]"
 */
async function parseAndExecuteAddCommand(
  rawQuery: string,
  categories: Category[],
  selectedDate: string
): Promise<BroActionResult> {
  let text = rawQuery.replace(/^(?:add\s+task|create\s+task|schedule\s+task|new\s+task|add)\s+/i, '').trim();

  let assignDateStr: string | null = null;
  let categoryStr: string | null = null;
  let priority: 'low' | 'medium' | 'high' = 'medium';

  // 1. Extract priority if mentioned
  if (/high\s+priority\b/i.test(text)) {
    priority = 'high';
    text = text.replace(/high\s+priority/i, '').trim();
  } else if (/low\s+priority\b/i.test(text)) {
    priority = 'low';
    text = text.replace(/low\s+priority/i, '').trim();
  }

  // 2. Extract assignment date:
  const assignMatch = text.match(
    /(?:assign(?:ed)?\s+(?:date\s+)?|for\s+|scheduled\s+for\s+)(today|tomorrow|\d{4}-\d{2}-\d{2}|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
  );

  if (assignMatch) {
    assignDateStr = resolveDateFromExpression(assignMatch[1], selectedDate);
    text = text.replace(assignMatch[0], '').trim();
  } else if (/\bassign\s+today\b/i.test(text)) {
    assignDateStr = formatDateKey(new Date());
    text = text.replace(/\bassign\s+today\b/i, '').trim();
  } else if (/\btoday\b/i.test(text)) {
    assignDateStr = formatDateKey(new Date());
    text = text.replace(/\btoday\b/i, '').trim();
  } else if (/\btomorrow\b/i.test(text)) {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    assignDateStr = formatDateKey(tmrw);
    text = text.replace(/\btomorrow\b/i, '').trim();
  }

  // 3. Extract category:
  const catMatch = text.match(
    /(?:in\s+category\s+|in\s+|under\s+category\s+|under\s+|category\s+)(["']?[^"'\s,]+["']?)/i
  );

  if (catMatch) {
    categoryStr = catMatch[1].replace(/["']/g, '').trim();
    text = text.replace(catMatch[0], '').trim();
  }

  // 4. Remaining text is the task title
  let title = text.replace(/^["']|["']$/g, '').trim();
  title = title.replace(/\s+(?:to|for|in|under|on)$/i, '').trim();

  if (!title) {
    title = 'New Objective';
  }

  const category = await resolveCategory(categoryStr || undefined, categories);
  const targetDate = assignDateStr || selectedDate;

  const newTask = await syncAddTask({
    title,
    categoryId: category.id,
    priority,
    deadline: targetDate,
    isRecurring: false,
  });

  if (targetDate) {
    await syncAddToToday(newTask.id, targetDate);
  }

  return {
    reply: `Added task **"${newTask.title}"** under **${category.name}** and assigned to **${targetDate}** [Priority: ${priority.toUpperCase()}]. Execute!`,
    actionTaken: 'added_task',
    details: newTask.title,
    success: true,
  };
}

/**
 * Direct call to Google Gemini API:
 * Provides full human natural language context understanding and returns structured action commands
 */
async function callGeminiLLM(
  query: string,
  categories: Category[],
  selectedDate: string,
  config: AIConfig
): Promise<BroActionResult | null> {
  const model = config.geminiModel || 'gemini-3.6-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey?.trim()}`;

  const todayStr = formatDateKey(new Date());
  const categoryNames = categories.map(c => c.name);
  
  // Get tasks actually scheduled for the selected date via daily plans
  const allPlans = getDailyPlans();
  const todayPlans = allPlans.filter(p => p.date === selectedDate);
  const todayTaskIds = todayPlans.map(p => p.taskId);
  const todayTasks = getTasks().filter(t => todayTaskIds.includes(t.id) && !t.archivedAt);
  
  const taskSummaries = todayTasks
    .slice(0, 20)
    .map(t => `"${t.title}" (Done: ${isTaskCompletedOnDate(t.id, selectedDate)})`)
    .join(', ');
  
  const activeTasks = getTasks().filter(t => !t.archivedAt);
  const activeTaskSummaries = activeTasks
    .slice(0, 10)
    .map(t => `"${t.title}"`)
    .join(', ');

  const systemInstructions = `You are Bro Bot, a helpful task assistant for BROMISE ("Do it for your younger self").
You understand natural language and help users manage their tasks.

Current App State:
- Today's Date: ${todayStr}
- Currently Selected Planner Date: ${selectedDate}
- Tasks Scheduled for ${selectedDate}: ${taskSummaries || 'None yet'}
- All Active Tasks (backlog): ${activeTaskSummaries || 'None yet'}
- Categories: ${categoryNames.join(', ')}

RULES:
1. Answer the user's question directly and clearly. Do not give unsolicited motivational speeches.
2. If asked about "today's tasks", list only tasks actually scheduled for today's date.
3. If asked about categories or master list, list those clearly.
4. If the user wants to perform a task action (add, complete, remove, reschedule, clear), output a JSON execution block at the start:
\`\`\`json
{
  "action": "add_task" | "complete_task" | "unmark_task" | "remove_task" | "reschedule_task" | "clear_completed" | "none",
  "taskTitle": "matched or new task title",
  "category": "category name (optional for adds)",
  "assignDate": "YYYY-MM-DD",
  "targetDate": "YYYY-MM-DD",
  "priority": "low" | "medium" | "high"
}
\`\`\`
5. After a successful action, you may give a brief, encouraging confirmation (1 sentence max).
6. For general questions or greetings, respond naturally without military/bro speak.

Examples:
- "check today's tasks" -> List tasks scheduled for today only, no preaching
- "add gym workout today" -> JSON action block + brief confirmation
- "hello" -> Friendly greeting, no JSON block
- "is there any minorproject task" -> Answer based on what tasks exist, ask for clarification if needed

Be helpful, direct, and concise.`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${systemInstructions}\n\nUser query: ${query}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 350,
    },
  };

  let res: Response | null = null;
  let lastErr: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) break;
      lastErr = await res.text().catch(() => res?.statusText || '');
      if (res.status !== 503) break;
      console.warn(`Gemini 503 retry ${attempt + 1}/5: ${lastErr}`);
    } catch (err: any) {
      lastErr = err.message;
      if (attempt === 4) break;
    }
    // backoff between retries (1.2s, 2.4s, 3.6s, 4.8s)
    await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
  }

  if (!res || !res.ok) {
    console.warn(`Gemini API error ${res?.status}:`, lastErr);
    return null;
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!rawText) return null;

  // Check if Gemini returned a JSON command block
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const parsedCmd = JSON.parse(jsonMatch[1]);
      const cleanReply = rawText.replace(/```json[\s\S]*?```/, '').trim();

      // 1. ADD TASK
      if (parsedCmd.action === 'add_task' && parsedCmd.taskTitle) {
        const cat = await resolveCategory(parsedCmd.category, categories);
        const date = parsedCmd.assignDate || selectedDate || todayStr;
        const priority = (parsedCmd.priority || 'medium') as 'low' | 'medium' | 'high';

        const newTask = await syncAddTask({
          title: parsedCmd.taskTitle,
          categoryId: cat.id,
          priority,
          deadline: date,
          isRecurring: false,
        });

        if (date) {
          await syncAddToToday(newTask.id, date);
        }

        return {
          reply:
            cleanReply ||
            `Added **"${newTask.title}"** under **${cat.name}** assigned to **${date}**!`,
          actionTaken: 'added_task',
          details: newTask.title,
          success: true,
        };
      }

      // 2. COMPLETE TASK
      if (parsedCmd.action === 'complete_task' && parsedCmd.taskTitle) {
        const match = findMatchingTask(parsedCmd.taskTitle);
        if (match) {
          const isDone = isTaskCompletedOnDate(match.id, selectedDate);
          if (!isDone) {
            await syncToggleCompletion(match.id, selectedDate);
          }
          await syncAddToToday(match.id, selectedDate);

          return {
            reply: cleanReply || `Marked **"${match.title}"** as completed for ${selectedDate}!`,
            actionTaken: 'completed_task',
            details: match.title,
            success: true,
          };
        }
      }

      // 3. UNMARK TASK
      if (parsedCmd.action === 'unmark_task' && parsedCmd.taskTitle) {
        const match = findMatchingTask(parsedCmd.taskTitle);
        if (match) {
          const isDone = isTaskCompletedOnDate(match.id, selectedDate);
          if (isDone) {
            await syncToggleCompletion(match.id, selectedDate);
          }
          return {
            reply: cleanReply || `Unmarked **"${match.title}"** back to pending for ${selectedDate}.`,
            actionTaken: 'uncompleted_task',
            details: match.title,
            success: true,
          };
        }
      }

      // 4. REMOVE / DELETE TASK
      if (parsedCmd.action === 'remove_task' && parsedCmd.taskTitle) {
        const match = findMatchingTask(parsedCmd.taskTitle);
        if (match) {
          await syncDeleteTask(match.id);
          await syncRemoveFromToday(match.id, selectedDate);
          return {
            reply: cleanReply || `Deleted **"${match.title}"** from your targets.`,
            actionTaken: 'deleted_task',
            details: match.title,
            success: true,
          };
        }
      }

      // 5. RESCHEDULE TASK
      if (parsedCmd.action === 'reschedule_task' && parsedCmd.taskTitle) {
        const match = findMatchingTask(parsedCmd.taskTitle);
        if (match) {
          const targetDate = parsedCmd.targetDate || resolveDateFromExpression(parsedCmd.assignDate || 'tomorrow', selectedDate);
          await syncRemoveFromToday(match.id, selectedDate);
          await syncUpdateTask(match.id, { deadline: targetDate });
          await syncAddToToday(match.id, targetDate);

          return {
            reply: cleanReply || `Rescheduled **"${match.title}"** to **${targetDate}**!`,
            actionTaken: 'rescheduled_task',
            details: `Moved ${match.title} to ${targetDate}`,
            success: true,
          };
        }
      }

      // 6. CLEAR COMPLETED
      if (parsedCmd.action === 'clear_completed') {
        const plans = getDailyPlans().filter(p => p.date === selectedDate);
        const completedTaskIds = plans
          .map(p => p.taskId)
          .filter(id => isTaskCompletedOnDate(id, selectedDate));

        for (const taskId of completedTaskIds) {
          await syncRemoveFromToday(taskId, selectedDate);
        }

        return {
          reply: cleanReply || `Cleared completed tasks from **${selectedDate}**!`,
          actionTaken: 'cleared_completed',
          success: true,
        };
      }

      return {
        reply: cleanReply || rawText,
        success: true,
      };
    } catch {}
  }

  return {
    reply: rawText,
    success: true,
  };
}

/**
 * Optional local Ollama call
 */
async function callOllamaLLM(
  query: string,
  categories: Category[],
  selectedDate: string,
  config: AIConfig
): Promise<BroActionResult | null> {
  const categoryNames = categories.map(c => c.name).join(', ');
  const systemPrompt = `You are Bro Bot, the disciplined, high-performance tactical assistant for BROMISE ("Do it for your younger self").
Available task categories: ${categoryNames}.
Selected date: ${selectedDate}.
Keep responses concise, energetic, and tactical. You can help users organize their tasks, plan their workouts, and conquer their daily goals.`;

  const res = await fetch(`${config.endpointUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model || 'llama3.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const reply = data.message?.content || "Command acknowledged, Bro. Let's attack the day!";

  return {
    reply,
    success: true,
  };
}
