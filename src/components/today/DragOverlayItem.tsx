import React from 'react';
import type { Task, Category } from '../../types';
import { IconHelper } from '../common/IconHelper';
import { getDeadlineStatus } from '../../utils/deadlineHelper';
import { GripVertical, Repeat, CalendarClock } from 'lucide-react';

interface DragOverlayItemProps {
  task: Task;
  category?: Category;
}

export const DragOverlayItem: React.FC<DragOverlayItemProps> = ({ task, category }) => {
  const priorityColors = {
    low: 'bg-dark-800 text-dark-500 border-dark-750',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  const deadlineStatus = getDeadlineStatus(task.deadline);

  return (
    <div className="flex items-center space-x-3 p-4 rounded-2xl border bg-dark-900 border-theme-accent shadow-2xl ring-2 ring-theme-accent/50 scale-105 pointer-events-none select-none">
      <div className="text-theme-accent p-1 rounded bg-dark-800">
        <GripVertical className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <h4 className="text-sm font-bold text-theme-title font-sans truncate">{task.title}</h4>

          {category && (
            <span
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border"
              style={{
                backgroundColor: `${category.accent}20`,
                color: category.accent,
                borderColor: `${category.accent}40`,
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
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-theme-accent/20 text-theme-accent border border-theme-accent/30">
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

        {task.notes && <p className="text-xs text-dark-400 mt-1 truncate">{task.notes}</p>}
      </div>
    </div>
  );
};
