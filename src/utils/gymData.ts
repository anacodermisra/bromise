import type { GymSchedule, MuscleGroup } from '../types';

export interface MuscleInfo {
  id: MuscleGroup;
  name: string;
  category: 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';
  description: string;
  view: 'front' | 'back' | 'both';
}

export const MUSCLE_REGISTRY: Record<MuscleGroup, MuscleInfo> = {
  chest: { id: 'chest', name: 'Chest (Pectorals)', category: 'chest', description: 'Primary pushing muscles', view: 'front' },
  upper_chest: { id: 'upper_chest', name: 'Upper Chest (Clavicular Head)', category: 'chest', description: 'Incline presses & flyes', view: 'front' },
  shoulders: { id: 'shoulders', name: 'Deltoids & Shoulders', category: 'shoulders', description: 'Overhead pressing & lateral raises', view: 'both' },
  front_delts: { id: 'front_delts', name: 'Front Deltoids', category: 'shoulders', description: 'Overhead & forward pressing', view: 'front' },
  side_delts: { id: 'side_delts', name: 'Lateral Deltoids', category: 'shoulders', description: 'Shoulder width & V-taper', view: 'both' },
  rear_delts: { id: 'rear_delts', name: 'Rear Deltoids', category: 'shoulders', description: 'Face pulls, reverse flyes, posture', view: 'back' },
  biceps: { id: 'biceps', name: 'Biceps Brachii', category: 'arms', description: 'Elbow flexion, pulling & curling', view: 'front' },
  triceps: { id: 'triceps', name: 'Triceps Brachii', category: 'arms', description: 'Elbow extension, pushing & dips', view: 'back' },
  forearms: { id: 'forearms', name: 'Forearms & Grip', category: 'arms', description: 'Wrist flexion, extension & grip strength', view: 'both' },
  lats: { id: 'lats', name: 'Latissimus Dorsi', category: 'back', description: 'Back width & pull-down power', view: 'back' },
  traps: { id: 'traps', name: 'Trapezius & Upper Back', category: 'back', description: 'Shrugs, rows & neck stability', view: 'back' },
  lower_back: { id: 'lower_back', name: 'Lower Back (Erectors)', category: 'back', description: 'Deadlifts, posterior chain stability', view: 'back' },
  abs: { id: 'abs', name: 'Abs (Rectus Abdominis)', category: 'core', description: 'Core flexion & 6-pack definition', view: 'front' },
  obliques: { id: 'obliques', name: 'Obliques', category: 'core', description: 'Rotational core power & waist definition', view: 'front' },
  quads: { id: 'quads', name: 'Quadriceps', category: 'legs', description: 'Squats, lunges, leg extensions', view: 'front' },
  hamstrings: { id: 'hamstrings', name: 'Hamstrings', category: 'legs', description: 'Leg curls, RDLs, hip extension', view: 'back' },
  glutes: { id: 'glutes', name: 'Gluteus Maximus', category: 'legs', description: 'Deadlifts, hip thrusts, sprinting power', view: 'back' },
  calves: { id: 'calves', name: 'Calves (Gastrocnemius & Soleus)', category: 'legs', description: 'Calf raises, ankle stability', view: 'both' },
};

// Clean gym schedule: zero prefilled dummy exercises so users start with a clean slate
export const DEFAULT_GYM_SCHEDULE: GymSchedule = {
  mon: {
    id: 'split-mon',
    dayOfWeek: 'mon',
    dayName: 'Monday',
    title: 'Push Day (Chest, Shoulders & Triceps)',
    focusMuscles: ['chest', 'upper_chest', 'front_delts', 'side_delts', 'triceps'],
    exercises: [],
  },
  tue: {
    id: 'split-tue',
    dayOfWeek: 'tue',
    dayName: 'Tuesday',
    title: 'Pull Day (Back, Rear Delts & Biceps)',
    focusMuscles: ['lats', 'traps', 'rear_delts', 'biceps', 'forearms'],
    exercises: [],
  },
  wed: {
    id: 'split-wed',
    dayOfWeek: 'wed',
    dayName: 'Wednesday',
    title: 'Leg Day & Quad Focus',
    focusMuscles: ['quads', 'hamstrings', 'glutes', 'calves'],
    exercises: [],
  },
  thu: {
    id: 'split-thu',
    dayOfWeek: 'thu',
    dayName: 'Thursday',
    title: 'Core & Conditioning (Abs & Cardio)',
    focusMuscles: ['abs', 'obliques'],
    exercises: [],
  },
  fri: {
    id: 'split-fri',
    dayOfWeek: 'fri',
    dayName: 'Friday',
    title: 'Upper Body Hypertrophy (Chest & Back)',
    focusMuscles: ['chest', 'lats', 'shoulders', 'biceps', 'triceps'],
    exercises: [],
  },
  sat: {
    id: 'split-sat',
    dayOfWeek: 'sat',
    dayName: 'Saturday',
    title: 'Lower Body & Posterior Chain',
    focusMuscles: ['quads', 'hamstrings', 'glutes', 'calves'],
    exercises: [],
  },
  sun: {
    id: 'split-sun',
    dayOfWeek: 'sun',
    dayName: 'Sunday',
    title: 'Active Recovery & Mobility',
    focusMuscles: [],
    restDay: true,
    exercises: [],
  },
};

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function getTodayDayKey(): 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' {
  const dayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
  const map: Record<number, 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
  };
  return map[dayIndex] || 'mon';
}
