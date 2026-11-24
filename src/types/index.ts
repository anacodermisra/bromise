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
  timeSlot?: string; // Format: "00:00" to "23:00" or custom "09:30"
  startTime?: string; // Format: "HH:mm" e.g. "09:30"
  endTime?: string; // Format: "HH:mm" e.g. "10:45"
  durationMinutes?: number; // Duration in minutes (e.g. 75)
  completed?: boolean;
}

export interface TaskCompletion {
  id: string;
  taskId: string;
  date: string; // Format: 'YYYY-MM-DD'
  completed: boolean;
  completedAt?: string | null;
}

export type ViewMode = 'today' | 'tasks' | 'gym' | 'study' | 'progress' | 'history' | 'settings';

export type MuscleGroup =
  | 'chest'
  | 'upper_chest'
  | 'shoulders'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'lats'
  | 'traps'
  | 'lower_back'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves';

export interface GymSet {
  setNumber: number;
  weightKg: number;
  reps: number;
  completed: boolean;
}

export interface GymExercise {
  id: string;
  name: string;
  targetMuscles: MuscleGroup[];
  defaultSets: number;
  defaultReps: string;
  defaultWeightKg: number;
  notes?: string;
  completed?: boolean;
  loggedSets?: GymSet[];
}

export interface DaySplit {
  id: string;
  dayOfWeek: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  dayName: string;
  title: string;
  focusMuscles: MuscleGroup[];
  exercises: GymExercise[];
  restDay?: boolean;
}

export interface GymSchedule {
  [dayKey: string]: DaySplit; // 'mon', 'tue', etc.
}

export interface StudyChapter {
  id: string;
  title: string;
  notes?: string;
  estimatedMinutes?: number;
  completed: boolean;
  completedAt?: string;
}

export interface StudyBook {
  id: string;
  title: string;
  code: string;
  color: string;
  category: string;
  shelf?: 'subjects' | 'courses' | 'reading' | string;
  chapters: StudyChapter[];
  notes?: string;
  targetDate?: string;
  icon?: string;
  createdAt: string;
}

export interface WallpaperConfig {
  enabled: boolean;
  type: 'preset' | 'custom';
  presetId?: string;
  customUrl?: string;
  dimOpacity: number; // 0.1 to 0.9
  blurPx: number; // 0 to 12
  roomWallpapers?: {
    gym?: string;
    study?: string;
  };
}

export interface DayStats {
  date: string;
  plannedCount: number;
  completedCount: number;
  percentage: number;
  categoriesRepresented: string[];
}

export interface HeatmapItem extends DayStats {
  isPadding?: boolean;
}

export interface StreakInfo {
  currentStreak: number;
  bestStreak: number;
  totalCompletedTasks: number;
  avgCompletionRate: number;
}
