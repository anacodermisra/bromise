export type Priority = 'low' | 'medium' | 'high';

export interface Category {
  id: string;
  name: string;
  icon: string;
  accent: string; // Hex or tailwind color code (e.g. #8b5cf6)
  position: number;
  createdAt: string;
  archivedAt?: string | null;
}

export interface RecurrenceRule {
  id: string;
  taskId: string;
  frequency: 'daily';
  active: boolean;
  startDate: string;
  endDate?: string | null;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  categoryId: string;
  priority: Priority;
  deadline?: string | null; // Format: 'YYYY-MM-DD'
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface DailyPlanItem {
  id: string;
  date: string; // Format: 'YYYY-MM-DD'
  taskId: string;
  position: number;
  sourceType: 'normal' | 'recurring';
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  date: string; // Format: 'YYYY-MM-DD'
  completed: boolean;
  completedAt?: string | null;
}

export type ViewMode = 'today' | 'tasks' | 'progress' | 'history' | 'settings';

export interface DayStats {
  date: string;
  plannedCount: number;
  completedCount: number;
  percentage: number;
  categoriesRepresented: string[];
}

export interface StreakInfo {
  currentStreak: number;
  bestStreak: number;
  totalCompletedTasks: number;
  avgCompletionRate: number;
}
