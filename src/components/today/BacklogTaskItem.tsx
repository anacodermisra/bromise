import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Task, Category } from '../../types';
import { IconHelper } from '../common/IconHelper';
import { getDeadlineStatus } from '../../utils/deadlineHelper';
import { GripVertical, Plus, Pencil, Trash2, Repeat, CalendarClock, CheckCircle } from 'lucide-react';

interface BacklogTaskItemProps {
  task: Task;
  category?: Category;
  isScheduledToday?: boolean;
  onAddToToday: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export const BacklogTaskItem: React.FC<BacklogTaskItemProps> = ({
  task,
  category,
  isScheduledToday,
  onAddToToday,
  onEditTask,
  onDeleteTask,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `backlog-${task.id}`,
    data: { task },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.1 : 1,
      }
    : undefined;

  const priorityColors = {
    low: 'bg-dark-800 text-dark-500 border-dark-750',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const deadlineStatus = getDeadlineStatus(task.deadline);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center space-x-3 p-3 rounded-xl border bg-dark-900/80 border-dark-800 hover:border-dark-700 hover:bg-dark-850/80 transition-all duration-200 ${
        isDragging ? 'z-50 shadow-2xl ring-2 ring-theme-accent' : ''
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-dark-600 hover:text-dark-400 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-dark-800 transition-colors"
        title="Drag into Today"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <h5 className="text-xs font-semibold text-dark-100 truncate font-sans">{task.title}</h5>

          {category && (
            <span
              className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border"
              style={{
                backgroundColor: `${category.accent}15`,
                color: category.accent,
                borderColor: `${category.accent}30`,
              }}
            >
              <IconHelper name={category.icon} className="w-2.5 h-2.5" style={{ color: category.accent }} />
              <span>{category.name}</span>
            </span>
          )}

          {isScheduledToday && (
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-theme-accent-secondary/15 text-theme-accent-secondary border border-theme-accent-secondary/30">
              <CheckCircle className="w-2.5 h-2.5 text-theme-accent-secondary" />
              <span>In Today's Plan</span>
            </span>
          )}

          {deadlineStatus && (
            <span
              className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${deadlineStatus.colorClass}`}
            >
              <CalendarClock className="w-2.5 h-2.5" />
              <span>{deadlineStatus.text}</span>
            </span>
          )}

          {task.isRecurring && (
            <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
              <Repeat className="w-2.5 h-2.5" />
              <span>Daily</span>
            </span>
          )}

          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border uppercase tracking-wider ${
              priorityColors[task.priority]
            }`}
          >
            {task.priority}
          </span>
        </div>

        {task.notes && <p className="text-[11px] text-dark-500 mt-0.5 truncate">{task.notes}</p>}
      </div>

      <div className="flex items-center space-x-1">
        {!isScheduledToday ? (
          <button
            onClick={() => onAddToToday(task.id)}
            className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-theme-accent/10 hover:bg-theme-accent/20 text-theme-accent text-[11px] font-semibold transition-colors border border-theme-accent/20"
            title="Add to Today's Plan"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Today</span>
          </button>
        ) : (
          <span className="text-[10px] text-theme-accent-secondary font-semibold px-2 py-1 bg-theme-accent-secondary/10 rounded-lg border border-theme-accent-secondary/20">
            Scheduled
          </span>
        )}

        <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
          <button
            onClick={() => onEditTask(task)}
            className="p-1 rounded text-dark-500 hover:text-theme-title hover:bg-dark-800 transition-colors"
            title="Edit task"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDeleteTask(task.id)}
            className="p-1 rounded text-dark-500 hover:text-rose-400 hover:bg-dark-800 transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
