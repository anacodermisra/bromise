import React, { useState, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Task, Category, DailyPlanItem } from '../../types';
import { IconHelper } from '../common/IconHelper';
import {
  Clock,
  Check,
  Trash2,
  X,
  Pencil,
  Sun,
  Moon,
  Sunset,
  Sparkles,
} from 'lucide-react';

interface TimetableViewProps {
  todayDate: string;
  todayPlan: DailyPlanItem[];
  tasks: Task[];
  categories: Category[];
  completions: Record<string, boolean>;
  onToggleComplete: (taskId: string) => void;
  onRemoveFromTimeSlot: (taskId: string) => void;
  onOpenTaskModal: (task?: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => {
  const h = i < 10 ? `0${i}:00` : `${i}:00`;
  return h;
});

type Quadrant = 'all' | 'morning' | 'afternoon' | 'evening' | 'night';

const HourDroppableSlot: React.FC<{
  hour: string;
  isCurrentHour: boolean;
  tasksInSlot: Task[];
  categories: Category[];
  completions: Record<string, boolean>;
  onToggleComplete: (taskId: string) => void;
  onRemoveFromTimeSlot: (taskId: string) => void;
  onOpenTaskModal: (task?: Task) => void;
  onDeleteTask: (taskId: string) => void;
}> = ({
  hour,
  isCurrentHour,
  tasksInSlot,
  categories,
  completions,
  onToggleComplete,
  onRemoveFromTimeSlot,
  onOpenTaskModal,
  onDeleteTask,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `hour-slot-${hour}`,
    data: { timeSlot: hour },
  });

  const priorityColors = {
    low: 'bg-dark-800 text-dark-500 border-dark-750',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <div
      ref={setNodeRef}
      className={`relative flex items-stretch border-b border-dark-800/80 transition-all ${
        isCurrentHour ? 'bg-theme-accent/5' : ''
      } ${isOver ? 'bg-theme-accent/15 ring-2 ring-theme-accent/50 z-10' : ''}`}
    >
      {/* Current Hour Indicator Line */}
      {isCurrentHour && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-theme-accent shadow-glow-accent z-20" />
      )}

      {/* Time Label Column */}
      <div className="w-16 sm:w-20 py-3.5 px-2 flex-shrink-0 flex flex-col items-center justify-start border-r border-dark-800/60 select-none">
        <span
          className={`text-xs font-mono font-bold ${
            isCurrentHour ? 'text-theme-accent' : 'text-dark-400'
          }`}
        >
          {hour}
        </span>
        {isCurrentHour && (
          <span className="mt-1 text-[9px] uppercase tracking-wider font-extrabold text-theme-accent px-1.5 py-0.2 rounded-full bg-theme-accent/20">
            NOW
          </span>
        )}
      </div>

      {/* Slot Content Area */}
      <div className="flex-1 p-2 sm:p-2.5 min-h-[56px] flex flex-col justify-center space-y-2">
        {tasksInSlot.length === 0 ? (
          <div className="h-full flex items-center justify-between px-2 text-dark-600 text-xs italic group hover:text-dark-400 transition-colors">
            <span className="text-[11px]">Drop task here to schedule for {hour}</span>
          </div>
        ) : (
          tasksInSlot.map(task => {
            const category = categories.find(c => c.id === task.categoryId);
            const isCompleted = !!completions[task.id];

            return (
              <div
                key={task.id}
                className={`group flex items-center space-x-3 p-2.5 rounded-xl border transition-all duration-200 interactive-card ${
                  isCompleted
                    ? 'bg-dark-900/40 border-dark-850 opacity-70'
                    : 'bg-dark-900/90 border-dark-800 hover:border-theme-accent/40 shadow-sm'
                }`}
              >
                <button
                  onClick={() => onToggleComplete(task.id)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-dark-950 shadow-glow-emerald'
                      : 'border-dark-600 hover:border-theme-accent hover:bg-theme-accent/10'
                  }`}
                >
                  {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span
                      className={`text-xs font-semibold truncate ${
                        isCompleted ? 'line-through text-dark-500' : 'text-theme-title'
                      }`}
                    >
                      {task.title}
                    </span>

                    {category && (
                      <span
                        className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border"
                        style={{
                          backgroundColor: `${category.accent}15`,
                          color: category.accent,
                          borderColor: `${category.accent}30`,
                        }}
                      >
                        <IconHelper
                          name={category.icon}
                          className="w-2.5 h-2.5"
                          style={{ color: category.accent }}
                        />
                        <span>{category.name}</span>
                      </span>
                    )}

                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border uppercase tracking-wider ${
                        priorityColors[task.priority]
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onOpenTaskModal(task)}
                    className="p-1 rounded text-dark-500 hover:text-theme-title hover:bg-dark-800 transition-colors"
                    title="Edit task"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onRemoveFromTimeSlot(task.id)}
                    className="p-1 rounded text-dark-500 hover:text-amber-400 hover:bg-dark-800 transition-colors"
                    title="Unassign time slot"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteTask(task.id)}
                    className="p-1 rounded text-dark-500 hover:text-rose-400 hover:bg-dark-800 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export const TimetableView: React.FC<TimetableViewProps> = ({
  todayDate,
  todayPlan,
  tasks,
  categories,
  completions,
  onToggleComplete,
  onRemoveFromTimeSlot,
  onOpenTaskModal,
  onDeleteTask,
}) => {
  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant>('all');
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = now.getHours() < 10 ? `0${now.getHours()}` : `${now.getHours()}`;
      const m = now.getMinutes() < 10 ? `0${now.getMinutes()}` : `${now.getMinutes()}`;
      setCurrentTime(`${h}:${m}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isActuallyToday = todayDate === new Date().toISOString().split('T')[0];
  const currentHourString = isActuallyToday ? `${currentTime.split(':')[0]}:00` : '';

  // Filter hours according to selected Quadrant
  const displayedHours = HOURS_24.filter(hour => {
    const h = parseInt(hour.split(':')[0], 10);
    if (activeQuadrant === 'morning') return h >= 6 && h < 12;
    if (activeQuadrant === 'afternoon') return h >= 12 && h < 18;
    if (activeQuadrant === 'evening') return h >= 18 && h <= 23;
    if (activeQuadrant === 'night') return h >= 0 && h < 6;
    return true; // 'all' 24 hours
  });

  // Group today's plan tasks by their timeSlot
  const tasksByHour: Record<string, Task[]> = {};
  HOURS_24.forEach(h => {
    tasksByHour[h] = [];
  });

  // Unassigned tasks in today's plan (no timeSlot yet)
  const unassignedTasks: Task[] = [];

  todayPlan.forEach(planItem => {
    const task = tasks.find(t => t.id === planItem.taskId);
    if (!task) return;
    if (planItem.timeSlot && tasksByHour[planItem.timeSlot]) {
      tasksByHour[planItem.timeSlot].push(task);
    } else {
      unassignedTasks.push(task);
    }
  });

  return (
    <div className="space-y-4 flex flex-col h-full">
      {/* Quadrant / Zoom Filters */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-dark-900 border border-dark-800 p-2 rounded-2xl">
        <div className="flex items-center space-x-1 overflow-x-auto">
          <button
            onClick={() => setActiveQuadrant('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeQuadrant === 'all'
                ? 'bg-theme-accent text-white shadow-glow-accent'
                : 'text-dark-400 hover:text-theme-title hover:bg-dark-850'
            }`}
          >
            Full 24h
          </button>
          <button
            onClick={() => setActiveQuadrant('morning')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeQuadrant === 'morning'
                ? 'bg-theme-accent text-white shadow-glow-accent'
                : 'text-dark-400 hover:text-theme-title hover:bg-dark-850'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Morning (06-12)</span>
          </button>
          <button
            onClick={() => setActiveQuadrant('afternoon')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeQuadrant === 'afternoon'
                ? 'bg-theme-accent text-white shadow-glow-accent'
                : 'text-dark-400 hover:text-theme-title hover:bg-dark-850'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Afternoon (12-18)</span>
          </button>
          <button
            onClick={() => setActiveQuadrant('evening')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeQuadrant === 'evening'
                ? 'bg-theme-accent text-white shadow-glow-accent'
                : 'text-dark-400 hover:text-theme-title hover:bg-dark-850'
            }`}
          >
            <Sunset className="w-3.5 h-3.5" />
            <span>Evening (18-24)</span>
          </button>
          <button
            onClick={() => setActiveQuadrant('night')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeQuadrant === 'night'
                ? 'bg-theme-accent text-white shadow-glow-accent'
                : 'text-dark-400 hover:text-theme-title hover:bg-dark-850'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Night (00-06)</span>
          </button>
        </div>

        {isActuallyToday && currentTime && (
          <div className="flex items-center space-x-2 text-xs text-theme-accent font-mono font-bold px-3 py-1 bg-theme-accent/10 border border-theme-accent/20 rounded-xl">
            <Clock className="w-3.5 h-3.5" />
            <span>Real Time: {currentTime}</span>
          </div>
        )}
      </div>

      {/* Unassigned Today Tasks Quick Strip */}
      {unassignedTasks.length > 0 && (
        <div className="bg-dark-900 border border-dark-800 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-dark-300">
              Unscheduled for specific hour ({unassignedTasks.length})
            </span>
            <span className="text-[11px] text-dark-500">Drag into any hour slot below</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unassignedTasks.map(task => {
              const cat = categories.find(c => c.id === task.categoryId);
              return (
                <div
                  key={task.id}
                  className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-dark-950 border border-dark-750 text-xs text-theme-title hover:border-theme-accent transition-colors"
                >
                  <span className="truncate max-w-[140px] font-medium">{task.title}</span>
                  {cat && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: cat.accent }}
                      title={cat.name}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 24-HOUR TIMETABLE GRID */}
      <div className="flex-1 bg-dark-900/90 border border-dark-800 rounded-3xl overflow-hidden shadow-xl max-h-[calc(100vh-280px)] overflow-y-auto">
        {displayedHours.map(hour => (
          <HourDroppableSlot
            key={hour}
            hour={hour}
            isCurrentHour={hour === currentHourString}
            tasksInSlot={tasksByHour[hour]}
            categories={categories}
            completions={completions}
            onToggleComplete={onToggleComplete}
            onRemoveFromTimeSlot={onRemoveFromTimeSlot}
            onOpenTaskModal={onOpenTaskModal}
            onDeleteTask={onDeleteTask}
          />
        ))}
      </div>
    </div>
  );
};
