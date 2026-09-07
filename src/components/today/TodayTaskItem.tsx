import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, Category } from '../../types';
import { IconHelper } from '../common/IconHelper';
import { getDeadlineStatus } from '../../utils/deadlineHelper';
import { GripVertical, Check, Repeat, ArrowRightLeft, Pencil, Trash2, CalendarClock, ListChecks } from 'lucide-react';

interface TodayTaskItemProps {
  task: Task;
  category?: Category;
  isCompleted: boolean;
  onToggleComplete: (taskId: string) => void;
  onRemoveFromToday: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export const TodayTaskItem: React.FC<TodayTaskItemProps> = ({
  task,
  category,
  isCompleted,
  onToggleComplete,
  onRemoveFromToday,
  onEditTask,
  onDeleteTask,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.1 : 1,
  };

  const priorityColors = {
    low: 'bg-dark-800 text-dark-500 border-dark-750',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const deadlineStatus = getDeadlineStatus(task.deadline);

  // Subtask progress
  const subtasks = task.subtasks || [];
  const totalSubtasks = subtasks.length;
  const doneSubtasks = subtasks.filter(s => s.done).length;
  const subtaskPct = totalSubtasks > 0 ? Math.round((doneSubtasks / totalSubtasks) * 100) : 0;
  const allSubtasksDone = totalSubtasks > 0 && doneSubtasks === totalSubtasks;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center space-x-3 p-3.5 rounded-2xl border transition-all duration-200 ${
        isCompleted
          ? 'bg-dark-900/40 border-dark-850 opacity-75'
          : 'bg-dark-900/90 border-dark-800 hover:border-dark-700 hover:bg-dark-850/80 shadow-sm'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-dark-600 hover:text-dark-400 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-dark-800 transition-colors"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <button
        onClick={() => onToggleComplete(task.id)}
        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
          isCompleted
            ? 'bg-emerald-500 border-emerald-500 text-dark-950 shadow-glow-emerald'
            : 'border-dark-600 hover:border-theme-accent hover:bg-theme-accent/10'
        }`}
      >
        {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <h4
            className={`text-sm font-semibold truncate font-sans transition-colors ${
              isCompleted ? 'line-through text-dark-500' : 'text-theme-title'
            }`}
          >
            {task.title}
          </h4>

          {category && (
            <span
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border"
              style={{
                backgroundColor: `${category.accent}15`,
                color: category.accent,
                borderColor: `${category.accent}30`,
              }}
            >
              <IconHelper name={category.icon} className="w-3 h-3" style={{ color: category.accent }} />
              <span>{category.name}</span>
            </span>
          )}

          {deadlineStatus && (
            <span
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${deadlineStatus.colorClass}`}
            >
              <CalendarClock className="w-3 h-3" />
              <span>{deadlineStatus.text}</span>
            </span>
          )}

          {task.isRecurring && (
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
              <Repeat className="w-3 h-3" />
              <span>Daily</span>
            </span>
          )}

          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border uppercase tracking-wider ${
              priorityColors[task.priority]
            }`}
          >
            {task.priority}
          </span>
        </div>

        {task.notes && (
          <p className={`text-xs mt-1 truncate ${isCompleted ? 'text-dark-600' : 'text-dark-500'}`}>
            {task.notes}
          </p>
        )}

        {/* Subtask progress bar */}
        {totalSubtasks > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center space-x-1 text-[10px] font-semibold ${
                allSubtasksDone ? 'text-emerald-400' : 'text-dark-400'
              }`}>
                <ListChecks className="w-3 h-3" />
                <span>{doneSubtasks}/{totalSubtasks} steps</span>
              </span>
              <span className={`text-[10px] font-bold tabular-nums ${
                allSubtasksDone ? 'text-emerald-400' : 'text-theme-accent'
              }`}>
                {subtaskPct}%
              </span>
            </div>
            <div className="w-full bg-dark-800 rounded-full h-1">
              <div
                className={`h-1 rounded-full transition-all duration-500 ${
                  allSubtasksDone
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-theme-accent to-theme-accent-secondary'
                }`}
                style={{ width: `${subtaskPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRemoveFromToday(task.id)}
          className="p-1.5 rounded-lg text-dark-500 hover:text-amber-400 hover:bg-dark-800 transition-colors"
          title="Move back to Backlog"
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onEditTask(task)}
          className="p-1.5 rounded-lg text-dark-500 hover:text-theme-accent hover:bg-dark-800 transition-colors"
          title="Edit task"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onDeleteTask(task.id)}
          className="p-1.5 rounded-lg text-dark-500 hover:text-rose-400 hover:bg-dark-800 transition-colors"
          title="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

