/**
 * BROMISE Sync Adapter
 *
 * This is the central data layer that connects the React app to either:
 * - The Express/SQLite backend (when online)
 * - LocalStorage (when offline or server unreachable)
 *
 * Sync flow:
 *   User action → update LocalStorage immediately (optimistic)
 *              → attempt API call
 *              → if API succeeds: mark synced (no-op, LocalStorage already correct)
 *              → if API fails: enqueue the operation to pending sync queue
 *              → when server comes back (health check): drain queue in order
 *
 * Rules:
 * - LocalStorage is always the source of truth for the UI.
 * - The server is the durable store.
 * - Pending queue is drained oldest-first; each op is retried once on reconnect.
 * - On first load, if server is reachable, we pull fresh data from API and
 *   write it to LocalStorage, overwriting stale local data ONLY if there are
 *   no pending local writes.
 */

import { api } from './api';
import {
  getCategories, saveCategories, addCategory as lsAddCategory,
  updateCategory as lsUpdateCategory, deleteCategory as lsDeleteCategory,
  getTasks, saveTasks, addTask as lsAddTask,
  updateTask as lsUpdateTask, deleteTask as lsDeleteTask, finishTask as lsFinishTask,
  getDailyPlans, saveDailyPlans, addTasksToDailyPlan as lsAddToPlan,
  removeTaskFromDailyPlan as lsRemoveFromPlan, reorderDailyPlan as lsReorder,
  getOrInitDailyPlan, assignTaskToTimeSlot as lsAssignTimeSlot, removeTaskTimeSlot as lsRemoveTimeSlot,
  togglePlanItemCompletion as lsTogglePlanItemCompletion,
  getCompletions, saveCompletions, toggleTaskCompletion as lsToggle,
  getDayStats, getHeatmapData, getStreakInfo,
  exportDataJSON, importDataJSON, resetToSeedData,
  isTaskCompletedOnDate, formatDateKey, getKey, getActiveUserId,
  getGymSchedule, saveGymSchedule, getStudyBooks, saveStudyBooks,
  getGuestSnapshot, clearGuestData,
} from '../utils/storage';
import type { Category, Task, DailyPlanItem, TaskCompletion, GymSchedule, StudyBook } from '../types';

// ─────────────────────────────────────────────────────────
// SERVER CONNECTIVITY STATE
// ─────────────────────────────────────────────────────────

const SERVER_CHECK_INTERVAL = 15_000; // ms
let _serverOnline = false;
let _isPulling = false;
export let _initialSyncDone = false;

export function isServerOnline(): boolean {
  return _serverOnline;
}

async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await api.health();
    return res?.status === 'ok';
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────
// PENDING SYNC QUEUE
// ─────────────────────────────────────────────────────────

interface SyncOp {
  id: string;
  type: string;
  payload: any;
  createdAt: string;
  retries?: number;
}

function getQueue(): SyncOp[] {
  try {
    return JSON.parse(localStorage.getItem(getKey('sync_queue')) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: SyncOp[]) {
  localStorage.setItem(getKey('sync_queue'), JSON.stringify(queue));
}

function recordDeadLetterOp(op: SyncOp, reason: string) {
  try {
    const dlqKey = getKey('sync_dead_letter');
    const existing = JSON.parse(localStorage.getItem(dlqKey) || '[]');
    existing.push({ ...op, failedAt: new Date().toISOString(), reason });
    localStorage.setItem(dlqKey, JSON.stringify(existing.slice(-50)));
  } catch {
    // ignore storage quota errors
  }
}

function enqueue(type: string, payload: any) {
  const queue = getQueue();
  queue.push({
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
  saveQueue(queue);
}

function dequeue(id: string) {
  saveQueue(getQueue().filter(op => op.id !== id));
}

export function clearQueue() {
  saveQueue([]);
}

export function getPendingSyncCount(): number {
  return getQueue().length;
}

async function drainQueue() {
  const queue = getQueue();
  if (queue.length === 0) return;

  for (const op of queue) {
    try {
      await executeOp(op);
      dequeue(op.id);
    } catch (err: any) {
      const msg = String(err?.message || '');
      const is404 = msg.includes('→ 404');
      const isPermanent4xx = /→ 40[0349]|→ 422/.test(msg);

      if (is404 || isPermanent4xx) {
        console.warn(`[sync] Permanent client error for op ${op.type}, quarantining:`, msg);
        recordDeadLetterOp(op, msg);
        dequeue(op.id);
        continue;
      }

      // Update retry count for transient errors
      const nextRetries = (op.retries || 0) + 1;
      if (nextRetries >= 8) {
        console.error(`[sync] Max retries reached for op ${op.type}, quarantining:`, msg);
        recordDeadLetterOp(op, msg);
        dequeue(op.id);
        continue;
      }

      const currentQueue = getQueue().map(item =>
        item.id === op.id ? { ...item, retries: nextRetries } : item
      );
      saveQueue(currentQueue);
      // Stop draining — server or network may be temporarily down
      break;
    }
  }
}

export async function flushSyncQueue(): Promise<boolean> {
  if (!getActiveUserId()) return true;
  if (getQueue().length === 0) return true;
  try {
    await drainQueue();
    return getQueue().length === 0;
  } catch {
    return false;
  }
}

async function executeOp(op: SyncOp) {
  const p = op.payload;
  switch (op.type) {
    case 'ADD_CATEGORY':    await api.createCategory(p); break;
    case 'UPDATE_CATEGORY': await api.updateCategory(p.id, p); break;
    case 'DELETE_CATEGORY': await api.deleteCategory(p.id, { action: p.action, targetCategoryId: p.targetCategoryId }); break;
    case 'ADD_TASK':        await api.createTask(p); break;
    case 'UPDATE_TASK':     await api.updateTask(p.id, p); break;
    case 'DELETE_TASK':     await api.deleteTask(p.id, p.date); break;
    case 'FINISH_TASK':     await api.finishTask(p.id, p.date); break;
    case 'ADD_PLAN':        await api.createPlan(p); break;
    case 'REMOVE_PLAN':     {
      const plans = await api.getPlans(p.date);
      const plan = plans.find((pl: any) => pl.taskId === p.taskId && pl.date === p.date);
      if (plan) await api.deletePlan(plan.id);
      break;
    }
    case 'REORDER_PLANS':   await api.reorderPlans(p.date, p.orderedTaskIds); break;
    case 'ASSIGN_TIME_SLOT': {
      if (p.planItemId) {
        await api.updatePlan(p.planItemId, {
          startTime: p.startTime,
          endTime: p.endTime,
          durationMinutes: p.durationMinutes,
        });
      } else {
        await api.createPlan({
          id: p.id,
          taskId: p.taskId,
          date: p.date,
          startTime: p.startTime,
          endTime: p.endTime,
          durationMinutes: p.durationMinutes,
          timeSlot: p.startTime,
        });
      }
      break;
    }
    case 'REMOVE_TIME_SLOT': {
      if (p.planItemId) {
        await api.deletePlan(p.planItemId);
      }
      break;
    }
    case 'TOGGLE_PLAN_ITEM_COMPLETION': {
      if (p.planItemId) {
        await api.updatePlan(p.planItemId, { completed: p.completed });
      }
      break;
    }
    case 'TOGGLE_COMPLETION': await api.toggleCompletion(p.taskId, p.date); break;
    case 'IMPORT_DATA':     await api.importData(p); break;
    case 'MERGE_DATA':      await api.mergeData(p); break;
    case 'SYNC_ROOMS':      await api.saveUserRooms(p); break;
    default: console.warn('[sync] Unknown op type:', op.type);
  }
}

async function mergeGuestDataIntoActiveAccount() {
  if (!getActiveUserId()) return;
  const guest = getGuestSnapshot();
  if (!guest.hasData) return;

  try {
    await api.mergeData({
      categories: guest.categories,
      tasks: guest.tasks,
      dailyPlans: guest.dailyPlans,
      completions: guest.completions,
      gymSchedule: guest.gymSchedule,
      studyBooks: guest.studyBooks,
    });
    clearGuestData();
    console.info('[sync] Merged guest session data into signed-in Google account.');
  } catch (err) {
    console.warn('[sync] Failed to merge guest data on startup; will retry later:', err);
  }
}

// ─────────────────────────────────────────────────────────
// INITIAL DATA LOAD FROM SERVER
// Pull server data into LocalStorage on startup when server
// is reachable AND there are no pending writes.
// ─────────────────────────────────────────────────────────

export async function pullFromServer() {
  await mergeGuestDataIntoActiveAccount();

  const hasPending = getQueue().length > 0;
  if (hasPending) {
    // Drain pending writes first before pulling
    await drainQueue();
    // If there are still pending ops (server still down), use local data
    if (getQueue().length > 0) return;
  }

  try {
    const [cats, tasks, plans, completions, userRooms] = await Promise.all([
      api.getCategories(),
      api.getTasks(),
      api.getPlans(),
      api.getCompletions(),
      api.getUserRooms().catch(() => ({ gymSchedule: null, studyBooks: null })),
    ]);

    // Safety check against destructive overwrite:
    // If server returned 0 categories and 0 tasks, but local storage already has valid user data,
    // NEVER destroy the local data! Instead push local data up to the server so it is preserved.
    const localCats = getCategories();
    const localTasks = getTasks();
    if (cats.length === 0 && tasks.length === 0 && (localCats.length > 0 || localTasks.length > 0)) {
      console.warn('[sync] Server returned 0 items while local has data. Preserving local data and syncing to server.');
      await api.importData({
        categories: localCats,
        tasks: localTasks,
        dailyPlans: getDailyPlans(),
        completions: getCompletions(),
        gymSchedule: getGymSchedule(),
        studyBooks: getStudyBooks(),
      }).catch(err => console.error('[sync] Push local to server failed:', err));
      return;
    }

    // Overwrite LocalStorage with fresh server data (suppress echo room sync events)
    _isPulling = true;
    try {
      saveCategories(cats);
      saveTasks(tasks);
      saveDailyPlans(plans);
      saveCompletions(completions);

      // Sync room data if present on server, or upload initial local rooms
      if (userRooms?.gymSchedule) {
        saveGymSchedule(userRooms.gymSchedule);
      } else {
        const localGym = getGymSchedule();
        if (localGym) {
          api.saveUserRooms({ gymSchedule: localGym }).catch(() => {});
        }
      }

      if (userRooms?.studyBooks && Array.isArray(userRooms.studyBooks) && userRooms.studyBooks.length > 0) {
        saveStudyBooks(userRooms.studyBooks);
      } else {
        const localBooks = getStudyBooks();
        if (localBooks && localBooks.length > 0) {
          api.saveUserRooms({ studyBooks: localBooks }).catch(() => {});
        }
      }
    } finally {
      _isPulling = false;
    }

    _initialSyncDone = true;
  } catch (e) {
    console.warn('[sync] Could not pull from server, using local data:', e);
  }
}

// ─────────────────────────────────────────────────────────
// BACKGROUND HEALTH CHECK & RECONNECT LOOP
// ─────────────────────────────────────────────────────────

export let _healthTimer: ReturnType<typeof setInterval> | null = null;

export function clearSyncState() {
  _serverOnline = false;
  _initialSyncDone = false;
  if (_healthTimer) {
    clearInterval(_healthTimer);
    _healthTimer = null;
  }
  console.log('[sync] Sync state cleared, health timer stopped');
}

export async function initSync(onStateChange?: () => void) {
  if (_healthTimer) {
    clearInterval(_healthTimer);
    _healthTimer = null;
  }
  _serverOnline = await checkServerHealth();

  if (_serverOnline) {
    await pullFromServer();
  }

  // Periodic health check
  _healthTimer = setInterval(async () => {
    const wasOnline = _serverOnline;
    _serverOnline = await checkServerHealth();

    if (!wasOnline && _serverOnline) {
      // Just came back online — drain queue
      await drainQueue();
      onStateChange?.();
    }
    if (wasOnline !== _serverOnline) {
      onStateChange?.();
    }
  }, SERVER_CHECK_INTERVAL);
}

// ─────────────────────────────────────────────────────────
// UNIFIED DATA ACCESS (used by App.tsx instead of storage directly)
// ─────────────────────────────────────────────────────────

// Helper: try API, fall back to local, enqueue if API fails
async function trySync(localOp: () => void, type: string, payload: any) {
  try {
    localOp(); // optimistic local update
  } catch (error) {
    console.error('[sync] Local operation failed:', error);
    return; // Don't sync if local update fails
  }

  if (_serverOnline) {
    try {
      await executeOp({ id: '', type, payload, createdAt: '' });
    } catch {
      _serverOnline = false;
      enqueue(type, payload);
    }
  } else {
    enqueue(type, payload);
  }
}

// ─── CATEGORIES ───────────────────────────────────────────
export function syncGetCategories(): Category[] {
  return getCategories();
}

export async function syncAddCategory(data: Omit<Category, 'id' | 'createdAt' | 'position'>): Promise<Category> {
  const cat = lsAddCategory(data);
  await trySync(() => {}, 'ADD_CATEGORY', cat);
  return cat;
}

export async function syncUpdateCategory(id: string, updates: Partial<Category>): Promise<void> {
  lsUpdateCategory(id, updates);
  await trySync(() => {}, 'UPDATE_CATEGORY', { id, ...updates });
}

export async function syncDeleteCategory(id: string, action: 'move' | 'delete', targetCategoryId?: string): Promise<void> {
  lsDeleteCategory(id, action, targetCategoryId);
  await trySync(() => {}, 'DELETE_CATEGORY', { id, action, targetCategoryId });
}

// ─── TASKS ────────────────────────────────────────────────
export function syncGetTasks(): Task[] {
  return getTasks();
}

export async function syncAddTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
  const task = lsAddTask(data);
  await trySync(() => {}, 'ADD_TASK', task);
  return task;
}

export async function syncUpdateTask(id: string, updates: Partial<Task>): Promise<void> {
  lsUpdateTask(id, updates);
  await trySync(() => {}, 'UPDATE_TASK', { id, ...updates });
}

export async function syncDeleteTask(id: string, date?: string): Promise<void> {
  const targetDate = date || formatDateKey(new Date());
  lsDeleteTask(id, targetDate);
  await trySync(() => {}, 'DELETE_TASK', { id, date: targetDate });
}

export async function syncFinishTask(id: string, date?: string): Promise<void> {
  const targetDate = date || formatDateKey(new Date());
  lsFinishTask(id, targetDate);
  await trySync(() => {}, 'FINISH_TASK', { id, date: targetDate });
}

// ─── PLANS ────────────────────────────────────────────────
export function syncGetDailyPlans(): DailyPlanItem[] {
  return getDailyPlans();
}

export function syncGetOrInitDailyPlan(date: string): DailyPlanItem[] {
  return getOrInitDailyPlan(date);
}

export async function syncAddToToday(taskId: string, date: string): Promise<void> {
  lsAddToPlan(date, [taskId]);
  await trySync(() => {}, 'ADD_PLAN', { taskId, date, sourceType: 'normal' });
}

export async function syncRemoveFromToday(taskId: string, date: string): Promise<void> {
  lsRemoveFromPlan(date, taskId);
  await trySync(() => {}, 'REMOVE_PLAN', { taskId, date });
}

export async function syncReorderToday(date: string, orderedTaskIds: string[]): Promise<void> {
  lsReorder(date, orderedTaskIds);
  await trySync(() => {}, 'REORDER_PLANS', { date, orderedTaskIds });
}

export async function syncAssignTimeSlot(
  date: string,
  taskId: string,
  startTime: string,
  durationMinutes: number = 60,
  endTime?: string,
  planItemId?: string
): Promise<DailyPlanItem> {
  const item = lsAssignTimeSlot(date, taskId, startTime, durationMinutes, endTime, planItemId);
  await trySync(() => {}, 'ASSIGN_TIME_SLOT', {
    id: item.id,
    date,
    taskId,
    startTime: item.startTime,
    endTime: item.endTime,
    durationMinutes: item.durationMinutes,
    planItemId: item.id,
  });
  return item;
}

export async function syncRemoveTimeSlot(planItemIdOrDate: string, taskId?: string): Promise<void> {
  lsRemoveTimeSlot(planItemIdOrDate, taskId);
  await trySync(() => {}, 'REMOVE_TIME_SLOT', {
    planItemId: taskId ? undefined : planItemIdOrDate,
    date: taskId ? planItemIdOrDate : undefined,
    taskId,
  });
}

export async function syncTogglePlanItemCompletion(planItemId: string): Promise<boolean> {
  const result = lsTogglePlanItemCompletion(planItemId);
  await trySync(() => {}, 'TOGGLE_PLAN_ITEM_COMPLETION', { planItemId, completed: result });
  return result;
}

// ─── COMPLETIONS ──────────────────────────────────────────
export function syncGetCompletions(): TaskCompletion[] {
  return getCompletions();
}

export async function syncToggleCompletion(taskId: string, date: string): Promise<boolean> {
  const result = lsToggle(taskId, date);
  await trySync(() => {}, 'TOGGLE_COMPLETION', { taskId, date });
  return result;
}

export { isTaskCompletedOnDate };

// ─── ANALYTICS ────────────────────────────────────────────
export { getDayStats, getHeatmapData, getStreakInfo };

// ─── EXPORT / IMPORT / RESET ──────────────────────────────
export { exportDataJSON };

export async function syncImportData(jsonStr: string): Promise<{ success: boolean; error?: string; count?: { categories: number; tasks: number } }> {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.tasks)) {
      return { success: false, error: 'Invalid backup file: categories and tasks arrays are required' };
    }

    // 1. Clear any stale pending sync operations before restoring new data
    clearQueue();

    // 2. Save to LocalStorage immediately so local state is fully restored
    const localSaved = importDataJSON(jsonStr);
    if (!localSaved) {
      return { success: false, error: 'Failed to parse and store backup locally' };
    }

    const payload = {
      categories: parsed.categories,
      tasks: parsed.tasks,
      dailyPlans: Array.isArray(parsed.dailyPlans)
        ? parsed.dailyPlans
        : (Array.isArray(parsed.daily_plans) ? parsed.daily_plans : []),
      completions: Array.isArray(parsed.completions) ? parsed.completions : [],
      gymSchedule: parsed.gymSchedule || parsed.gym_schedule || null,
      studyBooks: parsed.studyBooks || parsed.study_books || null,
    };

    // 2. If server is online, push to server directly and wait for confirmation
    if (_serverOnline) {
      try {
        const res = await api.importData(payload);
        return {
          success: true,
          count: res?.count || { categories: parsed.categories.length, tasks: parsed.tasks.length }
        };
      } catch (err: any) {
        console.warn('[sync] Direct server import failed, enqueuing for background sync:', err);
        enqueue('IMPORT_DATA', payload);
        return {
          success: true,
          count: { categories: parsed.categories.length, tasks: parsed.tasks.length }
        };
      }
    } else {
      // Offline: enqueue in pending sync queue
      enqueue('IMPORT_DATA', payload);
      return {
        success: true,
        count: { categories: parsed.categories.length, tasks: parsed.tasks.length }
      };
    }
  } catch (err: any) {
    console.error('[sync] syncImportData error:', err);
    return { success: false, error: err.message || 'Failed to parse JSON file' };
  }
}

export const importData = syncImportData;

export function resetData() {
  resetToSeedData();
}

// ─── ROOMS (GYM & STUDY CROSS-DEVICE SYNC) ─────────────────
export async function syncSaveGymSchedule(schedule: GymSchedule): Promise<void> {
  saveGymSchedule(schedule);
  await trySync(() => {}, 'SYNC_ROOMS', { gymSchedule: schedule });
}

export async function syncSaveStudyBooks(books: StudyBook[]): Promise<void> {
  saveStudyBooks(books);
  await trySync(() => {}, 'SYNC_ROOMS', { studyBooks: books });
}

// Automatic room change listener so any local room updates sync seamlessly
if (typeof window !== 'undefined') {
  window.addEventListener('bromise-gym-change', () => {
    if (!_isPulling && getActiveUserId()) {
      const gym = getGymSchedule();
      trySync(() => {}, 'SYNC_ROOMS', { gymSchedule: gym });
    }
  });

  window.addEventListener('bromise-study-change', () => {
    if (!_isPulling && getActiveUserId()) {
      const books = getStudyBooks();
      trySync(() => {}, 'SYNC_ROOMS', { studyBooks: books });
    }
  });
}

export { formatDateKey };
