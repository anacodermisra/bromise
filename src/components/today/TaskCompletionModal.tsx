import React from 'react';
import type { Task, Category } from '../../types';
import { CheckCircle2, Calendar, X, Sparkles, RefreshCw } from 'lucide-react';
import { IconHelper } from '../common/IconHelper';
import confetti from 'canvas-confetti';

interface TaskCompletionModalProps {
  isOpen: boolean;
  task: Task | null;
  category?: Category;
  onClose: () => void;
  onKeepInBacklog: () => void;
  onFinishTask: (taskId: string) => void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({
  isOpen,
  task,
  category,
  onClose,
  onKeepInBacklog,
  onFinishTask,
}) => {
  if (!isOpen || !task) return null;

  const handleFinish = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#8b5cf6', '#10b981', '#3b82f6', '#f59e0b'],
    });
    onFinishTask(task.id);
    onClose();
  };

  const handleKeepInBacklog = () => {
    onKeepInBacklog();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-dark-900 border border-dark-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 relative overflow-hidden">
        {/* Decorative Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleKeepInBacklog}
          className="absolute top-4 right-4 p-2 rounded-full text-dark-500 hover:text-white hover:bg-dark-800 transition-colors"
          title="Close (Keep in backlog)"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2 pt-2">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-glow-emerald">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black text-theme-title font-sans">
            Task Completed for Today!
          </h3>
          <p className="text-xs text-dark-400 max-w-xs mx-auto">
            Is this task completely finished, or would you like to keep it in your backlog for multi-day progress?
          </p>
        </div>

        {/* Task Preview Card */}
        <div className="p-4 rounded-2xl bg-dark-950 border border-dark-800 space-y-2">
          <div className="flex items-center space-x-2 text-[11px] font-semibold text-dark-400">
            {category && (
              <span className="flex items-center space-x-1" style={{ color: category.accent }}>
                <IconHelper name={category.icon} className="w-3.5 h-3.5" />
                <span>{category.name}</span>
              </span>
            )}
            {task.isRecurring && (
              <span className="flex items-center space-x-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                <RefreshCw className="w-3 h-3" />
                <span>Daily Recurring</span>
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-theme-title">
            {task.title}
          </div>
        </div>

        {/* Action Choices */}
        <div className="space-y-3 pt-1">
          <button
            onClick={handleKeepInBacklog}
            className="w-full p-4 rounded-2xl bg-dark-950 hover:bg-dark-850 border border-dark-800 hover:border-dark-700 text-left transition-all group flex items-start space-x-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-theme-title group-hover:text-blue-400 transition-colors">
                Keep Task in Backlog (Multi-day Task)
              </div>
              <div className="text-[11px] text-dark-500 mt-0.5">
                Keep this task active so you can schedule it again on future days.
              </div>
            </div>
          </button>

          <button
            onClick={handleFinish}
            className="w-full p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left transition-all group flex items-start space-x-3.5 shadow-glow-emerald"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300 transition-colors">
                Mark Entire Task Finished! 🎉
              </div>
              <div className="text-[11px] text-emerald-400/70 mt-0.5">
                Complete the task entirely and remove it from active backlog.
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
