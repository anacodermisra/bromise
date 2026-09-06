import React from 'react';
import { Plus, Sparkles, FolderPlus } from 'lucide-react';
import type { DayStats } from '../../types';

interface HeaderProps {
  stats: DayStats;
  onOpenNewTaskModal: () => void;
  onOpenNewCategoryModal: () => void;
  currentView: string;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  onOpenNewTaskModal,
  onOpenNewCategoryModal,
  currentView,
}) => {
  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning, execution time.';
    if (hour < 18) return 'Keep building momentum.';
    return 'Evening focus session.';
  };

  return (
    <header className="sticky top-0 z-20 bg-dark-950/80 backdrop-blur-md border-b border-dark-800/80 px-4 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center space-x-3">
        <div className="md:hidden w-9 h-9 rounded-xl bg-dark-900 border border-theme-accent/30 flex items-center justify-center shadow-glow-accent overflow-hidden flex-shrink-0 p-1">
          <img
            src="/logo.png"
            alt="BROMISE Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-theme-accent uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{formattedDate}</span>
          </div>
          <h2 className="text-lg md:text-xl font-bold text-theme-title font-sans mt-0.5">
            {currentView === 'today' ? getGreeting() : currentView.toUpperCase()}
          </h2>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {currentView === 'today' && stats.plannedCount > 0 && (
          <div className="hidden sm:flex items-center space-x-3 bg-dark-900 border border-dark-800 rounded-xl px-4 py-2">
            <div className="text-right">
              <div className="text-xs text-dark-500 font-medium">Daily Target</div>
              <div className="text-sm font-bold text-theme-title">
                {stats.completedCount} / {stats.plannedCount} tasks
              </div>
            </div>
            <div className="relative w-9 h-9 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-dark-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-theme-accent transition-all duration-500 ease-out"
                  strokeDasharray={`${stats.percentage}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[10px] font-bold text-theme-accent opacity-90">{stats.percentage}%</span>
            </div>
          </div>
        )}

        <button
          onClick={onOpenNewCategoryModal}
          className="hidden lg:flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-dark-500 hover:text-theme-title border border-dark-750 text-xs font-semibold transition-all duration-200"
        >
          <FolderPlus className="w-4 h-4 text-dark-500" />
          <span>Category</span>
        </button>

        <button
          onClick={onOpenNewTaskModal}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-theme-accent to-theme-accent-secondary hover:from-theme-accent/90 hover:to-theme-accent-secondary/90 text-white text-xs font-semibold shadow-glow-accent transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>
    </header>
  );
};
