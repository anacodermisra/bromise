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
  updateTask as lsUpdateTask, deleteTask as lsDeleteTask,
  getDailyPlans, saveDailyPlans, addTasksToDailyPlan as lsAddToPlan,
  removeTaskFromDailyPlan as lsRemoveFromPlan, reorderDailyPlan as lsReorder,
  getOrInitDailyPlan,
  getCompletions, saveCompletions, toggleTaskCompletion as lsToggle,
  getDayStats, getHeatmapData, getStreakInfo,
  exportDataJSON, importDataJSON, resetToSeedData,
  isTaskCompletedOnDate, formatDateKey, getKey,
} from '../utils/storage';
import type { Category, Task, DailyPlanItem, TaskCompletion } from '../types';

// ─────────────────────────────────────────────────────────
// SERVER CONNECTIVITY STATE
// ─────────────────────────────────────────────────────────

const SERVER_CHECK_INTERVAL = 15_000; // ms
let _serverOnline = false;
export let _initialSyncDone = false;

export function isServerOnline(): boolean {
  return _serverOnline;
}

async function checkServerHealth(): Promise<boolean> {
  try {
    await api.health();
    return true;
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

function enqueue(type: string, payload: any) {
  const queue = getQueue();
  queue.push({
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: new Date().toISOString(),
  });
  saveQueue(queue);
}

function dequeue(id: string) {
  saveQueue(getQueue().filter(op => op.id !== id));
}

async function drainQueue() {
  const queue = getQueue();
  if (queue.length === 0) return;

  for (const op of queue) {
    try {
      await executeOp(op);
      dequeue(op.id);
    } catch {
      // stop draining — server may have gone down again
      break;
    }
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
    case 'DELETE_TASK':     await api.deleteTask(p.id); break;
    case 'ADD_PLAN':        await api.createPlan(p); break;
    case 'REMOVE_PLAN':     {
      const plans = await api.getPlans(p.date);
      const plan = plans.find((pl: any) => pl.taskId === p.taskId && pl.date === p.date);
      if (plan) await api.deletePlan(plan.id);
      break;
    }
    case 'REORDER_PLANS':   await api.reorderPlans(p.date, p.orderedTaskIds); break;
    case 'TOGGLE_COMPLETION': await api.toggleCompletion(p.taskId, p.date); break;
    case 'IMPORT_DATA':     await api.importData(p); break;
    default: console.warn('[sync] Unknown op type:', op.type);
  }
}

// ─────────────────────────────────────────────────────────
// INITIAL DATA LOAD FROM SERVER
// Pull server data into LocalStorage on startup when server
// is reachable AND there are no pending writes.
// ─────────────────────────────────────────────────────────

export async function pullFromServer() {
  const hasPending = getQueue().length > 0;
  if (hasPending) {
    // Drain pending writes first before pulling
    await drainQueue();
    // If there are still pending ops (server still down), use local data
    if (getQueue().length > 0) return;
  }

  try {
    const [cats, tasks, plans, completions] = await Promise.all([
      api.getCategories(),
      api.getTasks(),
      api.getPlans(),
      api.getCompletions(),
    ]);

    // Overwrite LocalStorage with fresh server data
    saveCategories(cats);
    saveTasks(tasks);
    saveDailyPlans(plans);
    saveCompletions(completions);
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
  localOp(); // optimistic local update
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

export async function syncDeleteTask(id: string): Promise<void> {
  lsDeleteTask(id);
  await trySync(() => {}, 'DELETE_TASK', { id });
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

export function importData(jsonStr: string): boolean {
  const result = importDataJSON(jsonStr);
  if (result) {
    const parsed = JSON.parse(jsonStr);
    // Try to sync with server too
    trySync(() => {}, 'IMPORT_DATA', parsed);
  }
  return result;
}

export function resetData() {
  resetToSeedData();
}

export { formatDateKey };
