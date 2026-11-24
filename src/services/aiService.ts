import type { Category, Task, AIConfig } from '../types';
import {
  getTasks,
  getDailyPlans,
  cleanPrefilledTasks,
  formatDateKey,
  getGymSchedule,
  getStudyBooks,
  getCategories,
  getCompletions,
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
 * Build the exact database snapshot Bro Bot is allowed to answer from.
 * Everything here is read fresh from localStorage (which is synced from the server DB).
 * The LLM is explicitly forbidden from using anything outside this block.
 */
function buildDatabaseSnapshot(selectedDate: string): string {
  const categories = getCategories();
  const tasks = getTasks();
  const plans = getDailyPlans();
  const completions = getCompletions();

  const catName = (id: string) =>
    categories.find(c => c.id === id)?.name ?? '(category deleted — raw id: ' + id + ')';

  const scheduledDates = (taskId: string) =>
    Array.from(new Set(plans.filter(p => p.taskId === taskId).map(p => p.date))).sort();

  const completedDates = (taskId: string) =>
    completions.filter(c => c.taskId === taskId && c.completed).map(c => c.date).sort();

  const activeTasks = tasks.filter(t => !t.archivedAt);
  const archivedTasks = tasks.filter(t => !!t.archivedAt);
  const maxTasks = 180;

  const categoryLines = categories.map(c => {
    const n = activeTasks.filter(t => t.categoryId === c.id).length;
    return `- id="${c.id}" name="${c.name}" (${n} active task${n === 1 ? '' : 's'})`;
  });

  const taskLines = activeTasks.slice(0, maxTasks).map(t => {
    const scheduled = scheduledDates(t.id);
    const done = completedDates(t.id);
    const bits = [
      `id="${t.id}"`,
      `title="${t.title}"`,
      `category="${catName(t.categoryId)}"`,
      `categoryId="${t.categoryId}"`,
      `priority=${t.priority}`,
    ];
    if (t.deadline) bits.push(`deadline=${t.deadline}`);
    bits.push(`scheduled=[${scheduled.join(', ') || 'none'}]`);
    bits.push(`completed=[${done.join(', ') || 'never'}]`);
    if (t.notes) bits.push(`notes="${t.notes}"`);
    return '- ' + bits.join(' | ');
  });

  const archivedLines = archivedTasks.slice(0, 40).map(t =>
    `- title="${t.title}" category="${catName(t.categoryId)}" archivedAt=${t.archivedAt ?? 'unknown'}`
  );

  const plansByDate = new Map<string, string[]>();
  plans.forEach(p => {
    const arr = plansByDate.get(p.date) ?? [];
    const title = tasks.find(t => t.id === p.taskId)?.title ?? p.taskId;
    arr.push(title);
    plansByDate.set(p.date, arr);
  });
  const planLines = Array.from(plansByDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 60)
    .map(([date, titles]) => `- ${date}: ${Array.from(new Set(titles)).join(', ')}`);

  const doneByDate = new Map<string, string[]>();
  completions.filter(c => c.completed).forEach(c => {
    const arr = doneByDate.get(c.date) ?? [];
    arr.push(tasks.find(t => t.id === c.taskId)?.title ?? c.taskId);
    doneByDate.set(c.date, arr);
  });
  const historyLines = Array.from(doneByDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 60)
    .map(([date, titles]) => `- ${date}: ${titles.join(', ')}`);

  const orphans = activeTasks.filter(t =>
    !categories.some(c => c.id === t.categoryId)
  );

  return [
    '=== DATABASE SNAPSHOT (read fresh from localStorage, synced from the Turso server DB) ===',
    `Selected planner date: ${selectedDate}`,
    `Totals: ${categories.length} categories, ${activeTasks.length} active tasks, ${archivedTasks.length} archived tasks, ${plans.length} plan rows, ${completions.length} completion rows`,
    '',
    '=== CATEGORIES — this is the complete authoritative category list ===',
    categoryLines.join('\n') || '(none stored)',
    '',
    '=== ACTIVE TASKS — search ALL of these for name/keyword questions ===',
    taskLines.join('\n') || '(none stored)',
    activeTasks.length > maxTasks ? `(${activeTasks.length - maxTasks} more active tasks omitted — say so if you hit the limit)` : '',
    '',
    '=== ARCHIVED / DELETED TASKS — never present these as active ===',
    archivedLines.join('\n') || '(none)',
    '',
    '=== DAILY PLANS BY DATE — use for "today", "scheduled", and date questions ===',
    planLines.join('\n') || '(none)',
    '',
    '=== COMPLETION HISTORY BY DATE — use for "old data", "history", "completed", "streak" questions ===',
    historyLines.join('\n') || '(none)',
    '',
    '=== ORPHANED TASKS (category was deleted from the database) ===',
    orphans.length
      ? orphans.slice(0, 20).map(t => `- "${t.title}" has raw categoryId ${t.categoryId}`).join('\n')
      : '(none)',
    '=== END DATABASE SNAPSHOT ===',
  ].filter(Boolean).join('\n');
}

/** Find a category strictly from the authoritative stored list. */
function findStoredCategory(name: string): Category | null {
  const clean = name.trim().toLowerCase().replace(/^["']|["']$/g, '');
  if (!clean) return null;
  const cats = getCategories();
  const exact = cats.find(c => c.name.toLowerCase() === clean);
  if (exact) return exact;
  return cats.find(c =>
    c.name.toLowerCase().includes(clean) || clean.includes(c.name.toLowerCase())
  ) ?? null;
}

/** Main command execution entrypoint:
 * Understands both human natural language (via Gemini LLM) and deterministic direct commands.
 */
export async function executeBroCommand(
  input: string,
  selectedDate: string
): Promise<BroActionResult> {
  const query = input.trim();
  const lower = query.toLowerCase();
  const config = getStoredAIConfig();

  // Always read fresh categories from storage — the prop can go stale
  // if categories are added/edited after the component mounts
  const categories = getCategories();

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

  // ─────────────────────────────────────────────────────────────
  // 2a. Database / data-source questions — answered from stored records
  // ─────────────────────────────────────────────────────────────
  if (
    lower === 'database' ||
    lower === 'show database' ||
    lower.includes('where do you get your data') ||
    lower.includes('source of data') ||
    lower.includes('which database')
  ) {
    const cats = getCategories();
    const allTasks = getTasks();
    return {
      reply: [
        '**BROMISE database:**',
        `• Categories: ${cats.length}`,
        `• Tasks: ${allTasks.filter(t => !t.archivedAt).length} active, ${allTasks.filter(t => t.archivedAt).length} archived`,
        `• Daily plan rows: ${getDailyPlans().length}`,
        `• Completion rows: ${getCompletions().length}`,
        '',
        'I read these records from this browser\'s localStorage, which is synced with the Turso server database. Settings → Database Viewer shows every raw record.',
      ].join('\n'),
      success: true,
    };
  }

  // Today's tasks — deterministic, no LLM guessing
  if (lower.includes("today's task") || lower === 'today' || lower === 'today tasks') {
    const plans = getDailyPlans().filter(p => p.date === selectedDate);
    const tasks = getTasks().filter(t => !t.archivedAt && plans.some(p => p.taskId === t.id));
    const categories = getCategories();
    if (tasks.length === 0) {
      return {
        reply: `No tasks are scheduled for ${selectedDate} in the database.`,
        success: true,
      };
    }
    const lines = tasks.map(t => {
      const done = getCompletions().some(c => c.taskId === t.id && c.date === selectedDate && c.completed);
      const cat = categories.find(c => c.id === t.categoryId)?.name ?? '(deleted category)';
      return `${done ? '✅' : '⏳'} **${t.title}** — ${cat}${done ? ' (done)' : ''}`;
    });
    return {
      reply: `**Tasks scheduled for ${selectedDate}:**\n\n${lines.join('\n')}`,
      success: true,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2b. Category questions — resolved against the authoritative stored category list
  // ─────────────────────────────────────────────────────────────
  const categoryQuery =
    query.match(/^(?:(?:list|show|view|what\s+are\s+my)\s+)?tasks?\s+(?:in|under|from|of)\s+(.+?)\s*\??$/i) ||
    query.match(/^(.+?)\s+(?:category\s+)?tasks?\s*\??$/i);

  if (categoryQuery) {
    const rawCategory = categoryQuery[1].replace(/\s+category\s*$/i, '').replace(/^["']|["']$/g, '').trim();
    const isCommandWord = /^(?:list|show|view|my|all|what are my|give|find|search|today|tomorrow|yesterday|scheduled|the|a)$/i.test(rawCategory);
    if (rawCategory && !isCommandWord) {
      const cat = findStoredCategory(rawCategory);
      if (cat) {
        const matching = getTasks().filter(t => !t.archivedAt && t.categoryId === cat.id);
        const plans = getDailyPlans();
        if (matching.length === 0) {
          return {
            reply: `The **${cat.name}** category exists, but it has no active tasks in the database.`,
            success: true,
          };
        }
        const lines = matching.map(t => {
          const dates = Array.from(new Set(plans.filter(p => p.taskId === t.id).map(p => p.date))).sort();
          const done = getCompletions().some(c => c.taskId === t.id && c.date === selectedDate && c.completed);
          return `• **${t.title}**${dates.length ? ` — scheduled ${dates.join(', ')}` : ''}${done ? ' (done on selected date)' : ''}`;
        });
        return {
          reply: `**${matching.length} task(s) in ${cat.name}:**\n\n${lines.join('\n')}`,
          success: true,
        };
      }
      const explicitlyCategory =
        /\bcategory\b/i.test(query) ||
        /^(?:(?:list|show|view|what\s+are\s+my)\s+)?tasks?\s+(?:in|under|from|of)\b/i.test(query);
      if (explicitlyCategory) {
        const available = getCategories().map(c => c.name).join(', ');
        return {
          reply: `No category named **${rawCategory}** exists in the database. Available categories: ${available || '(none)'}.`,
          success: true,
        };
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2c. Task lookup questions — search ALL active tasks, every date
  // ─────────────────────────────────────────────────────────────
  const taskSearch =
    query.match(/^(?:is|are)\s+there\s+(?:any\s+)?tasks?\s+(?:for|about|on|named|called|matching)\s+(.+?)\s*\??$/i) ||
    query.match(/^(?:do|does)\s+(?:i|my)\s+have\s+(?:any\s+)?(.+?)\s+tasks?\s*\??$/i) ||
    query.match(/^(?:find|search)\s+(?:for\s+)?(?:tasks?\s+(?:for|about|named|called)\s+)?(.+?)\s*\??$/i) ||
    query.match(/^any\s+task\s+for\s+(.+?)\s*\??$/i);

  if (taskSearch) {
    const needle = taskSearch[1].replace(/^["']|["']$/g, '').trim().toLowerCase();
    const isDateWord = /^(today|tomorrow|yesterday|this week|last week|all)$/.test(needle);
    if (needle && !isDateWord) {
      const categories = getCategories();
      const plans = getDailyPlans();
      const activeTasks = getTasks().filter(t => !t.archivedAt);
      const tokens = needle.split(/[\s,.:;!?'"-]+/).filter(t => t.length >= 2);
      const matches = activeTasks.filter(t => {
        const title = t.title.toLowerCase();
        const cat = (categories.find(c => c.id === t.categoryId)?.name ?? '').toLowerCase();
        return title.includes(needle) || needle.includes(title) || cat.includes(needle) ||
          tokens.some(tok => title.includes(tok) || cat.includes(tok));
      });
      if (matches.length === 0) {
        const sample = activeTasks.slice(0, 8).map(t => `"${t.title}"`).join(', ');
        return {
          reply: `No active task matching **${needle}** in the database.${sample ? ` Existing tasks include: ${sample}` : ''}`,
          success: true,
        };
      }
      const lines = matches.slice(0, 15).map(t => {
        const dates = Array.from(new Set(plans.filter(p => p.taskId === t.id).map(p => p.date))).sort();
        const cat = categories.find(c => c.id === t.categoryId)?.name ?? '(deleted category)';
        return `• **${t.title}** — category: ${cat}${dates.length ? `, scheduled ${dates.join(', ')}` : ''}`;
      });
      return {
        reply: `${matches.length} matching task(s):\n\n${lines.join('\n')}`,
        success: true,
      };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2d. Historical / old-data questions
  // ─────────────────────────────────────────────────────────────
  if (
    lower.includes('old data') ||
    lower === 'history' ||
    lower.includes('completed tasks') ||
    lower.includes('past tasks') ||
    lower.includes('yesterday') ||
    lower.includes('last week')
  ) {
    const tasks = getTasks();
    const completions = getCompletions().filter(c => c.completed);
    const plans = getDailyPlans();
    const doneByDate = new Map<string, string[]>();
    completions.forEach(c => {
      const arr = doneByDate.get(c.date) ?? [];
      arr.push(tasks.find(t => t.id === c.taskId)?.title ?? c.taskId);
      doneByDate.set(c.date, arr);
    });
    const recent = Array.from(doneByDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 10)
      .map(([date, titles]) => `• **${date}**: ${titles.join(', ')}`)
      .join('\n');
    return {
      reply: [
        `**Stored history:** ${plans.length} plan rows across ${new Set(plans.map(p => p.date)).size} dates, ${completions.length} completion records, ${tasks.filter(t => t.archivedAt).length} archived tasks.`,
        recent ? `\nRecent completed dates:\n${recent}` : '\nNo completed tasks recorded yet.',
        '',
        'Full history is in the Database Viewer (Settings → Database Viewer → Daily Plans / Completions).',
      ].join('\n'),
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
      const ollamaResult = await callOllamaLLM(query, selectedDate, config);
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
  const databaseSnapshot = buildDatabaseSnapshot(selectedDate);

  const systemInstructions = `You are Bro Bot, the task assistant for BROMISE ("Do it for your younger self").
You answer questions strictly from the app's stored records.

=== STRICT DATA SOURCE (highest priority rules) ===
1. The DATABASE SNAPSHOT at the bottom is the ONLY valid source of truth. It is generated fresh from BROMISE localStorage, which is synced from the Turso server database. Never use memory, assumptions, or earlier conversation as evidence.
2. A category exists if and only if it appears under CATEGORIES. If a name is not there, say it is not in the database. Never claim a category exists or does not exist from intuition.
3. A task's category is determined ONLY by its categoryId. When it says "(category deleted — raw id: ...)", the parent category was deleted; report that honestly instead of guessing.
4. "Today's tasks" / "scheduled" / a specific date: use DAILY PLANS BY DATE for that date only.
5. Name or keyword searches (for example "any task for ey", "linkedin tasks", "minorproject task"): search the ENTIRE ACTIVE TASKS list across all dates, not just today's plan. Compare loosely — short tokens like "ey" must match a task titled "EY".
6. "Old data", "history", "completed", "yesterday", "last week", streaks: use COMPLETION HISTORY BY DATE and DAILY PLANS BY DATE across all dates.
7. ARCHIVED / DELETED TASKS are never active. Never include them in a "my tasks" or "today" answer unless the user explicitly asks about deleted items.
8. Categories are never tasks. Never list a category as a task.
9. If the answer is not present in the snapshot, say so plainly and point the user to Settings → Database Viewer. Never invent tasks, categories, dates, counts, or completion states.
10. Answer directly and concisely. Do not give unsolicited motivational speeches, military language, or "bro" pep talks.

=== OUTPUT FORMAT ===
For questions, answer in plain markdown with bullets when listing items. Include category and status where useful.
For task actions only, put a JSON block at the very start:
\`\`\`json
{
  "action": "add_task" | "complete_task" | "unmark_task" | "remove_task" | "reschedule_task" | "clear_completed" | "none",
  "taskTitle": "matched or new task title",
  "category": "exact category name from CATEGORIES",
  "assignDate": "YYYY-MM-DD",
  "targetDate": "YYYY-MM-DD",
  "priority": "low" | "medium" | "high"
}
\`\`\`
After a successful action, at most one short confirmation sentence. For greetings, just greet normally.

${databaseSnapshot}`;

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
      maxOutputTokens: 900,
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
  selectedDate: string,
  config: AIConfig
): Promise<BroActionResult | null> {
  const databaseSnapshot = buildDatabaseSnapshot(selectedDate);
  const systemPrompt = `You are Bro Bot, the task assistant for BROMISE ("Do it for your younger self").
Answer strictly from the DATABASE SNAPSHOT below. It is read fresh from the app's localStorage, synced from the Turso server DB.
- A category exists only if it appears under CATEGORIES. Never guess categories.
- Search ALL ACTIVE TASKS for name/keyword questions, not just today's plan.
- Use DAILY PLANS BY DATE for today/scheduled questions.
- Use COMPLETION HISTORY BY DATE for old data, history, completed tasks.
- Archived tasks are never active. Categories are never tasks.
- If the answer is not in the snapshot, say so plainly and point to Settings → Database Viewer. Never invent data.
- Be direct and concise. No motivational speeches or military language.

${databaseSnapshot}`;

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
