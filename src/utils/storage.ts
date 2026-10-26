import type { Category, Task, DailyPlanItem, TaskCompletion } from '../types';
import { formatDateKey } from './seedData';

export { formatDateKey };

let _activeUserId: string | null = null;

export function setActiveUser(userId: string | null) {
  _activeUserId = userId;
  cleanupLegacyStorageKeys();
}

export function getActiveUserId(): string | null {
  return _activeUserId;
}

export function cleanupLegacyStorageKeys() {
  const legacyKeys = [
    'bromise_categories',
    'bromise_tasks',
    'bromise_daily_plans',
    'bromise_completions',
    'bromise_sync_queue',
    'bromise_account_created',
  ];
  legacyKeys.forEach(k => localStorage.removeItem(k));
}

export function getKey(subKey: string): string {
  if (_activeUserId) {
    return `bromise_user_${_activeUserId}_${subKey}`;
  }
  return `bromise_guest_${subKey}`;
}

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────
export function initStorage() {
  cleanupLegacyStorageKeys();
  const catKey = getKey('categories');
  const taskKey = getKey('tasks');
  if (localStorage.getItem(catKey) === null) {
    localStorage.setItem(catKey, JSON.stringify([]));
  }
  if (localStorage.getItem(taskKey) === null) {
    localStorage.setItem(taskKey, JSON.stringify([]));
  }
}

// ─────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────
export function getCategories(): Category[] {
  try {
    const data = localStorage.getItem(getKey('categories'));
    if (!data) return [];
    const cats: Category[] = JSON.parse(data);
    return cats.sort((a, b) => a.position - b.position);
  } catch {
    return [];
  }
}

export function saveCategories(categories: Category[]) {
  localStorage.setItem(getKey('categories'), JSON.stringify(categories));
}

export function addCategory(category: Omit<Category, 'id' | 'createdAt' | 'position'>): Category {
  const categories = getCategories();
  const newCat: Category = {
    ...category,
    id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    position: categories.length,
    createdAt: new Date().toISOString(),
  };
  saveCategories([...categories, newCat]);
  return newCat;
}

export function updateCategory(id: string, updates: Partial<Category>): Category[] {
  const categories = getCategories().map(cat =>
    cat.id === id ? { ...cat, ...updates } : cat
  );
  saveCategories(categories);
  return categories;
}

export function deleteCategory(id: string, action: 'move' | 'delete', targetCategoryId?: string) {
  let categories = getCategories().filter(cat => cat.id !== id);
  categories = categories.map((cat, idx) => ({ ...cat, position: idx }));
  saveCategories(categories);

  let tasks = getTasks();
  if (action === 'delete') {
    tasks = tasks.filter(task => task.categoryId !== id);
  } else if (action === 'move' && targetCategoryId) {
    tasks = tasks.map(task =>
      task.categoryId === id ? { ...task, categoryId: targetCategoryId } : task
    );
  }
  saveTasks(tasks);
}

// ─────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────
export function getTasks(): Task[] {
  try {
    const data = localStorage.getItem(getKey('tasks'));
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  localStorage.setItem(getKey('tasks'), JSON.stringify(tasks));
}

export function addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Task {
  const tasks = getTasks();
  const newTask: Task = {
    ...task,
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveTasks([...tasks, newTask]);
  return newTask;
}

export function updateTask(id: string, updates: Partial<Task>): Task[] {
  const tasks = getTasks().map(task =>
    task.id === id ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
  );
  saveTasks(tasks);
  return tasks;
}

export function deleteTask(id: string) {
  const tasks = getTasks().map(t => t.id === id ? { ...t, archivedAt: new Date().toISOString() } : t);
  saveTasks(tasks);
  const today = formatDateKey(new Date());
  const plans = getDailyPlans().filter(p => !(p.taskId === id && p.date > today));
  saveDailyPlans(plans);
}

// ─────────────────────────────────────────────────────────────
// DAILY PLANS
// ─────────────────────────────────────────────────────────────
export function getDailyPlans(): DailyPlanItem[] {
  try {
    const data = localStorage.getItem(getKey('daily_plans'));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveDailyPlans(plans: DailyPlanItem[]) {
  localStorage.setItem(getKey('daily_plans'), JSON.stringify(plans));
}

export function getOrInitDailyPlan(dateStr: string): DailyPlanItem[] {
  const allPlans = getDailyPlans();
  const datePlans = allPlans.filter(p => p.date === dateStr);
  const tasks = getTasks();

  const recurringTasks = tasks.filter(
    t => t.isRecurring && (!t.recurrenceRule || t.recurrenceRule.active)
  );

  let updated = false;
  const newPlans = [...allPlans];

  recurringTasks.forEach(recTask => {
    const exists = datePlans.some(p => p.taskId === recTask.id);
    if (!exists) {
      const planItem: DailyPlanItem = {
        id: `plan-${dateStr}-${recTask.id}`,
        date: dateStr,
        taskId: recTask.id,
        position: datePlans.length,
        sourceType: 'recurring',
      };
      datePlans.push(planItem);
      newPlans.push(planItem);
      updated = true;
    }
  });

  if (updated) saveDailyPlans(newPlans);
  return datePlans.sort((a, b) => a.position - b.position);
}

export function addTasksToDailyPlan(dateStr: string, taskIds: string[]) {
  const allPlans = getDailyPlans();
  const datePlans = allPlans.filter(p => p.date === dateStr);
  let maxPos = datePlans.length > 0 ? Math.max(...datePlans.map(p => p.position)) + 1 : 0;

  const newItems: DailyPlanItem[] = [];
  taskIds.forEach(taskId => {
    if (!datePlans.some(p => p.taskId === taskId)) {
      newItems.push({
        id: `plan-${dateStr}-${taskId}`,
        date: dateStr,
        taskId,
        position: maxPos++,
        sourceType: 'normal',
      });
    }
  });

  if (newItems.length > 0) saveDailyPlans([...allPlans, ...newItems]);
}

export function removeTaskFromDailyPlan(dateStr: string, taskId: string) {
  const allPlans = getDailyPlans().filter(
    p => !(p.date === dateStr && p.taskId === taskId)
  );
  saveDailyPlans(allPlans);
}

export function reorderDailyPlan(dateStr: string, reorderedTaskIds: string[]) {
  const allPlans = getDailyPlans();
  const otherPlans = allPlans.filter(p => p.date !== dateStr);
  const targetPlans = allPlans.filter(p => p.date === dateStr);

  // Preserve all slots for each task while updating positions
  const updatedTargetPlans: DailyPlanItem[] = [];
  reorderedTaskIds.forEach((taskId, idx) => {
    const slotsForTask = targetPlans.filter(p => p.taskId === taskId);
    if (slotsForTask.length > 0) {
      slotsForTask.forEach(slot => {
        updatedTargetPlans.push({ ...slot, position: idx });
      });
    } else {
      updatedTargetPlans.push({
        id: `plan-${dateStr}-${taskId}`,
        date: dateStr,
        taskId,
        position: idx,
        sourceType: 'normal',
      });
    }
  });

  saveDailyPlans([...otherPlans, ...updatedTargetPlans]);
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const parts = startTime.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const totalMins = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMins / 60) % 24;
  const endM = totalMins % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(endH)}:${pad(endM)}`;
}

export function calculateDurationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let startTotal = (sh || 0) * 60 + (sm || 0);
  let endTotal = (eh || 0) * 60 + (em || 0);
  if (endTotal < startTotal) {
    endTotal += 24 * 60; // Spans past midnight
  }
  return Math.max(15, endTotal - startTotal);
}

export function assignTaskToTimeSlot(
  dateStr: string,
  taskId: string,
  startTime: string,
  durationMinutes: number = 60,
  endTime?: string,
  planItemId?: string
): DailyPlanItem {
  const allPlans = getDailyPlans();
  const calculatedEnd = endTime || calculateEndTime(startTime, durationMinutes);

  // 1. If an existing planItemId is specified, update that exact slot
  if (planItemId) {
    const existingIndex = allPlans.findIndex(p => p.id === planItemId);
    if (existingIndex !== -1) {
      const updatedItem: DailyPlanItem = {
        ...allPlans[existingIndex],
        startTime,
        endTime: calculatedEnd,
        durationMinutes,
        timeSlot: startTime,
      };
      allPlans[existingIndex] = updatedItem;
      saveDailyPlans([...allPlans]);
      return updatedItem;
    }
  }

  // 2. If no planItemId, check if there's an unassigned plan item for this task on this date
  const unassignedIndex = allPlans.findIndex(
    p => p.date === dateStr && p.taskId === taskId && !p.startTime && !p.timeSlot
  );

  if (unassignedIndex !== -1) {
    const updatedItem: DailyPlanItem = {
      ...allPlans[unassignedIndex],
      startTime,
      endTime: calculatedEnd,
      durationMinutes,
      timeSlot: startTime,
    };
    allPlans[unassignedIndex] = updatedItem;
    saveDailyPlans([...allPlans]);
    return updatedItem;
  }

  // 3. Otherwise, create a NEW time slot for this task on this date (supports multi-slot per day!)
  const datePlans = allPlans.filter(p => p.date === dateStr);
  const maxPos = datePlans.length > 0 ? Math.max(...datePlans.map(p => p.position)) + 1 : 0;
  const newItem: DailyPlanItem = {
    id: `slot-${dateStr}-${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: dateStr,
    taskId,
    position: maxPos,
    sourceType: 'normal',
    startTime,
    endTime: calculatedEnd,
    durationMinutes,
    timeSlot: startTime,
  };

  saveDailyPlans([...allPlans, newItem]);
  return newItem;
}

export function removeTaskTimeSlot(targetIdOrDate: string, taskId?: string) {
  const allPlans = getDailyPlans();

  let planItemId = '';
  if (taskId) {
    const dateStr = targetIdOrDate;
    const found = allPlans.find(
      p => p.date === dateStr && p.taskId === taskId && (p.startTime || p.timeSlot)
    );
    if (found) planItemId = found.id;
  } else {
    planItemId = targetIdOrDate;
  }

  if (!planItemId) return;
  const target = allPlans.find(p => p.id === planItemId);
  if (!target) return;

  // Check how many slots this task has on this date
  const slotsForTask = allPlans.filter(
    p => p.date === target.date && p.taskId === target.taskId
  );

  if (slotsForTask.length > 1) {
    // If there were multiple slots, remove just this one
    saveDailyPlans(allPlans.filter(p => p.id !== planItemId));
  } else {
    // If this was the only slot, clear the time fields so the task stays in today's plan
    const updated = allPlans.map(p =>
      p.id === planItemId
        ? {
            ...p,
            startTime: undefined,
            endTime: undefined,
            durationMinutes: undefined,
            timeSlot: undefined,
          }
        : p
    );
    saveDailyPlans(updated);
  }
}

export function togglePlanItemCompletion(planItemId: string): boolean {
  const allPlans = getDailyPlans();
  const target = allPlans.find(p => p.id === planItemId);
  if (!target) return false;

  const newStatus = !target.completed;
  const updated = allPlans.map(p =>
    p.id === planItemId ? { ...p, completed: newStatus } : p
  );
  saveDailyPlans(updated);
  return newStatus;
}

// ─────────────────────────────────────────────────────────────
// COMPLETIONS
// ─────────────────────────────────────────────────────────────
export function getCompletions(): TaskCompletion[] {
  try {
    const data = localStorage.getItem(getKey('completions'));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCompletions(completions: TaskCompletion[]) {
  localStorage.setItem(getKey('completions'), JSON.stringify(completions));
}

export function toggleTaskCompletion(taskId: string, dateStr: string): boolean {
  const completions = getCompletions();
  const existingIndex = completions.findIndex(c => c.taskId === taskId && c.date === dateStr);

  let isNowCompleted = true;
  if (existingIndex >= 0) {
    isNowCompleted = !completions[existingIndex].completed;
    completions[existingIndex] = {
      ...completions[existingIndex],
      completed: isNowCompleted,
      completedAt: isNowCompleted ? new Date().toISOString() : undefined,
    };
  } else {
    completions.push({
      id: `comp-${dateStr}-${taskId}`,
      taskId,
      date: dateStr,
      completed: true,
      completedAt: new Date().toISOString(),
    });
  }

  saveCompletions(completions);
  return isNowCompleted;
}

export function isTaskCompletedOnDate(taskId: string, dateStr: string): boolean {
  const completions = getCompletions();
  const record = completions.find(c => c.taskId === taskId && c.date === dateStr);
  return !!(record && record.completed);
}

// ─────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────
export function getDayStats(dateStr: string) {
  const plan = getDailyPlans().filter(p => p.date === dateStr);
  const tasks = getTasks();
  const categories = getCategories();

  const validPlanItems = plan.filter(item => tasks.some(t => t.id === item.taskId));
  
  // Deduplicate unique tasks for the day:
  // Multiple time slots of the same activity constitute ONE task in the stats & add-ups!
  const uniqueTaskIds: string[] = [];
  validPlanItems.forEach(item => {
    if (!uniqueTaskIds.includes(item.taskId)) {
      uniqueTaskIds.push(item.taskId);
    }
  });

  const plannedCount = uniqueTaskIds.length;
  let completedCount = 0;
  const categoriesSet = new Set<string>();

  uniqueTaskIds.forEach(taskId => {
    const taskSlots = validPlanItems.filter(p => p.taskId === taskId);
    // Task is completed if marked complete in completions OR if all its scheduled slots are done
    const isCompleted =
      isTaskCompletedOnDate(taskId, dateStr) ||
      (taskSlots.length > 0 && taskSlots.every(s => s.completed));

    if (isCompleted) completedCount++;

    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const cat = categories.find(c => c.id === task.categoryId);
      if (cat) categoriesSet.add(cat.name);
    }
  });

  const percentage = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;

  return {
    date: dateStr,
    plannedCount,
    completedCount,
    percentage,
    categoriesRepresented: Array.from(categoriesSet),
  };
}

export function getAccountStartDate(): string {
  const tasks = getTasks();
  const plans = getDailyPlans();
  const completions = getCompletions();
  const categories = getCategories();

  const dates: string[] = [];

  for (const t of tasks) {
    if (t.createdAt) dates.push(t.createdAt.split('T')[0]);
  }
  for (const c of categories) {
    if (c.createdAt) dates.push(c.createdAt.split('T')[0]);
  }
  for (const p of plans) {
    if (p.date) dates.push(p.date);
  }
  for (const c of completions) {
    if (c.date) dates.push(c.date);
  }

  const saved = localStorage.getItem(getKey('account_created'));
  if (saved) dates.push(saved);

  dates.sort();

  let earliest = dates[0];
  if (!earliest) {
    earliest = formatDateKey(new Date());
  }

  if (!saved) {
    localStorage.setItem(getKey('account_created'), earliest);
  }

  return earliest;
}

export interface HeatmapItem {
  date: string;
  plannedCount: number;
  completedCount: number;
  percentage: number;
  categoriesRepresented: string[];
  isPadding?: boolean;
}

export function getHeatmapDataRange(startDateStr: string, endDateStr: string): HeatmapItem[] {
  const allPlans = getDailyPlans();
  const datesWithPlans = new Set(allPlans.map(p => p.date));

  const startParts = startDateStr.split('-').map(Number);
  const endParts = endDateStr.split('-').map(Number);

  const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
  const end = new Date(endParts[0], endParts[1] - 1, endParts[2]);

  const items: HeatmapItem[] = [];

  const startDayOfWeek = start.getDay();
  for (let p = 0; p < startDayOfWeek; p++) {
    items.push({
      date: `pad-start-${p}`,
      plannedCount: 0,
      completedCount: 0,
      percentage: 0,
      categoriesRepresented: [],
      isPadding: true,
    });
  }

  const curr = new Date(start);
  while (curr <= end) {
    const dateStr = formatDateKey(curr);
    if (!datesWithPlans.has(dateStr)) {
      items.push({ date: dateStr, plannedCount: 0, completedCount: 0, percentage: 0, categoriesRepresented: [] });
    } else {
      items.push(getDayStats(dateStr));
    }
    curr.setDate(curr.getDate() + 1);
  }

  const remainder = items.length % 7;
  if (remainder !== 0) {
    const needPad = 7 - remainder;
    for (let p = 0; p < needPad; p++) {
      items.push({
        date: `pad-end-${p}`,
        plannedCount: 0,
        completedCount: 0,
        percentage: 0,
        categoriesRepresented: [],
        isPadding: true,
      });
    }
  }

  return items;
}

export function getHeatmapData(daysCount = 365): HeatmapItem[] {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (daysCount - 1));
  return getHeatmapDataRange(formatDateKey(start), formatDateKey(today));
}

export function getStreakInfo() {
  const today = new Date();
  const allPlans = getDailyPlans();
  const datesWithPlans = new Set(allPlans.map(p => p.date));
  const completions = getCompletions();

  let currentStreak = 0;
  let bestStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDateKey(d);
    if (!datesWithPlans.has(dateStr)) continue;

    const stats = getDayStats(dateStr);
    if (stats.plannedCount > 0 && stats.completedCount > 0) {
      tempStreak++;
      if (i === 0 || currentStreak === i) currentStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else if (stats.plannedCount > 0) {
      tempStreak = 0;
    }
  }

  const totalCompletedTasks = completions.filter(c => c.completed).length;

  let totalPct = 0;
  let activeDays = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDateKey(d);
    if (!datesWithPlans.has(dateStr)) continue;
    const stats = getDayStats(dateStr);
    if (stats.plannedCount > 0) {
      totalPct += stats.percentage;
      activeDays++;
    }
  }

  return {
    currentStreak,
    bestStreak,
    totalCompletedTasks,
    avgCompletionRate: activeDays > 0 ? Math.round(totalPct / activeDays) : 0,
  };
}

// ─────────────────────────────────────────────────────────────
// EXPORT / IMPORT / RESET
// ─────────────────────────────────────────────────────────────
export function exportDataJSON(): string {
  return JSON.stringify(
    {
      categories: getCategories(),
      tasks: getTasks(),
      dailyPlans: getDailyPlans(),
      completions: getCompletions(),
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

export function importDataJSON(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.categories && parsed.tasks) {
      saveCategories(parsed.categories);
      saveTasks(parsed.tasks);
      if (parsed.dailyPlans) saveDailyPlans(parsed.dailyPlans);
      if (parsed.completions) saveCompletions(parsed.completions);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function resetToSeedData() {
  const keys = ['categories', 'tasks', 'daily_plans', 'completions', 'account_created'];
  keys.forEach(k => localStorage.removeItem(getKey(k)));
  initStorage();
}
