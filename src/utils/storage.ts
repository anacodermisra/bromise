import type { Category, Task, DailyPlanItem, TaskCompletion } from '../types';
import { INITIAL_CATEGORIES, INITIAL_TASKS, formatDateKey } from './seedData';

export { formatDateKey };

const KEYS = {
  CATEGORIES: 'bromise_categories',
  TASKS: 'bromise_tasks',
  DAILY_PLANS: 'bromise_daily_plans',
  COMPLETIONS: 'bromise_completions',
};

// ─────────────────────────────────────────────────────────────
// INIT — Only categories and tasks seeded; NO fake history
// ─────────────────────────────────────────────────────────────
export function initStorage() {
  if (!localStorage.getItem(KEYS.CATEGORIES)) {
    localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(INITIAL_CATEGORIES));
  }
  if (!localStorage.getItem(KEYS.TASKS)) {
    localStorage.setItem(KEYS.TASKS, JSON.stringify(INITIAL_TASKS));
  }
  // Daily plans and completions start empty — only genuine user data
}

// ─────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────
export function getCategories(): Category[] {
  try {
    const data = localStorage.getItem(KEYS.CATEGORIES);
    if (!data) return INITIAL_CATEGORIES;
    const cats: Category[] = JSON.parse(data);
    return cats.sort((a, b) => a.position - b.position);
  } catch {
    return INITIAL_CATEGORIES;
  }
}

export function saveCategories(categories: Category[]) {
  localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories));
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
    const data = localStorage.getItem(KEYS.TASKS);
    if (!data) return INITIAL_TASKS;
    return JSON.parse(data);
  } catch {
    return INITIAL_TASKS;
  }
}

export function saveTasks(tasks: Task[]) {
  localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
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
  const tasks = getTasks().filter(t => t.id !== id);
  saveTasks(tasks);
  // Remove only future plans — preserve historical plans for analytics accuracy
  const today = formatDateKey(new Date());
  const plans = getDailyPlans().filter(p => !(p.taskId === id && p.date > today));
  saveDailyPlans(plans);
}

// ─────────────────────────────────────────────────────────────
// DAILY PLANS
// ─────────────────────────────────────────────────────────────
export function getDailyPlans(): DailyPlanItem[] {
  try {
    const data = localStorage.getItem(KEYS.DAILY_PLANS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveDailyPlans(plans: DailyPlanItem[]) {
  localStorage.setItem(KEYS.DAILY_PLANS, JSON.stringify(plans));
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

  const updatedTargetPlans = reorderedTaskIds.map((taskId, idx) => {
    const existing = targetPlans.find(p => p.taskId === taskId);
    if (existing) return { ...existing, position: idx };
    return {
      id: `plan-${dateStr}-${taskId}`,
      date: dateStr,
      taskId,
      position: idx,
      sourceType: 'normal' as const,
    };
  });

  saveDailyPlans([...otherPlans, ...updatedTargetPlans]);
}

// ─────────────────────────────────────────────────────────────
// COMPLETIONS
// ─────────────────────────────────────────────────────────────
export function getCompletions(): TaskCompletion[] {
  try {
    const data = localStorage.getItem(KEYS.COMPLETIONS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCompletions(completions: TaskCompletion[]) {
  localStorage.setItem(KEYS.COMPLETIONS, JSON.stringify(completions));
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
// STATS — computed purely from real plan & completion records
// ─────────────────────────────────────────────────────────────
export function getDayStats(dateStr: string) {
  const plan = getOrInitDailyPlan(dateStr);
  const tasks = getTasks();
  const categories = getCategories();

  const plannedCount = plan.length;
  let completedCount = 0;
  const categoriesSet = new Set<string>();

  plan.forEach(item => {
    if (isTaskCompletedOnDate(item.taskId, dateStr)) completedCount++;
    const task = tasks.find(t => t.id === item.taskId);
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

export function getHeatmapData(daysCount = 365) {
  const today = new Date();
  const allPlans = getDailyPlans();
  const datesWithPlans = new Set(allPlans.map(p => p.date));

  return Array.from({ length: daysCount }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (daysCount - 1 - i));
    const dateStr = formatDateKey(d);
    if (!datesWithPlans.has(dateStr)) {
      return { date: dateStr, plannedCount: 0, completedCount: 0, percentage: 0, categoriesRepresented: [] };
    }
    return getDayStats(dateStr);
  });
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
      localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(parsed.categories));
      localStorage.setItem(KEYS.TASKS, JSON.stringify(parsed.tasks));
      if (parsed.dailyPlans) localStorage.setItem(KEYS.DAILY_PLANS, JSON.stringify(parsed.dailyPlans));
      if (parsed.completions) localStorage.setItem(KEYS.COMPLETIONS, JSON.stringify(parsed.completions));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function resetToSeedData() {
  Object.values(KEYS).forEach(key => localStorage.removeItem(key));
  initStorage();
}
