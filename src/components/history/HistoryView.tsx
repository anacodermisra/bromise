import React, { useState } from 'react';
import { getDayStats, getDailyPlans, isTaskCompletedOnDate, formatDateKey } from '../../utils/storage';
import type { Category, Task } from '../../types';
import { Calendar as CalendarIcon, CheckCircle2, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface HistoryViewProps {
  categories: Category[];
  tasks: Task[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({ categories, tasks }) => {
  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(new Date()));
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());

  const dayStats = getDayStats(selectedDate);
  const planItems = getDailyPlans().filter(p => p.date === selectedDate);

  const handlePrevMonth = () => {
    const prev = new Date(currentMonthDate);
    prev.setMonth(prev.getMonth() - 1);
    setCurrentMonthDate(prev);
  };

  const handleNextMonth = () => {
    const next = new Date(currentMonthDate);
    next.setMonth(next.getMonth() + 1);
    setCurrentMonthDate(next);
  };

  const getCalendarDays = () => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    const totalDays = lastDayOfMonth.getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({
        dateStr: formatDateKey(prevDate),
        dayNum: prevDate.getDate(),
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push({
        dateStr: formatDateKey(d),
        dayNum: i,
        isCurrentMonth: true,
      });
    }

    return days;
  };

  const calendarDays = getCalendarDays();
  const monthLabel = currentMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="space-y-1">
        <div className="flex items-center space-x-2 text-xs font-semibold text-theme-accent-secondary uppercase tracking-widest">
          <CalendarIcon className="w-4 h-4" />
          <span>Historical Archive & Execution Audit</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-theme-title font-sans">
          Historical Daily Records
        </h2>
        <p className="text-sm text-dark-500">
          Select any date from the calendar to inspect historical plans, completions, and category breakdowns.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-theme-title font-sans">{monthLabel}</h3>
            <div className="flex items-center space-x-1">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-theme-title transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-theme-title transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="py-1 font-bold text-dark-500 uppercase tracking-wider text-[10px]">
                {day}
              </div>
            ))}

            {calendarDays.map((day, idx) => {
              const stats = getDayStats(day.dateStr);
              const isSelected = selectedDate === day.dateStr;

              return (
                <button
                  key={`${day.dateStr}-${idx}`}
                  onClick={() => setSelectedDate(day.dateStr)}
                  className={`p-2.5 rounded-2xl flex flex-col items-center justify-between min-h-[52px] transition-all relative border ${
                    isSelected
                      ? 'bg-theme-accent text-white border-theme-accent/70 shadow-glow-accent scale-105 z-10'
                      : day.isCurrentMonth
                      ? 'bg-dark-950 border-dark-800 text-dark-200 hover:border-dark-700 hover:bg-dark-850'
                      : 'bg-dark-950/40 border-transparent text-dark-600'
                  }`}
                >
                  <span className="text-xs font-bold">{day.dayNum}</span>

                  {stats.plannedCount > 0 && (
                    <div className="w-full mt-1">
                      <div
                        className={`text-[9px] font-extrabold px-1 rounded-md ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : stats.percentage === 100
                            ? 'bg-theme-accent-secondary/20 text-theme-accent-secondary'
                            : 'bg-theme-accent/20 text-theme-accent'
                        }`}
                      >
                        {stats.percentage}%
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-5">
          <div className="border-b border-dark-800 pb-4 space-y-1">
            <div className="text-xs text-theme-accent font-semibold uppercase tracking-wider">
              Selected Date Summary
            </div>
            <h3 className="text-xl font-bold text-theme-title font-sans">{selectedDate}</h3>

            <div className="flex items-center space-x-3 pt-2">
              <div className="px-3 py-1 rounded-xl bg-dark-950 border border-dark-800 text-xs font-bold text-theme-title">
                {dayStats.completedCount} / {dayStats.plannedCount} Completed
              </div>
              <div className="px-3 py-1 rounded-xl bg-theme-accent/10 border border-theme-accent/20 text-xs font-bold text-theme-accent">
                {dayStats.percentage}% Total
              </div>
            </div>
          </div>

          {dayStats.categoriesRepresented.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-dark-500 uppercase tracking-wider">
                Categories Active
              </label>
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                {dayStats.categoriesRepresented.map(catName => (
                  <span
                    key={catName}
                    className="px-2.5 py-1 rounded-lg bg-dark-950 border border-dark-800 text-xs font-semibold text-dark-300"
                  >
                    {catName}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[11px] font-bold text-dark-500 uppercase tracking-wider">
              Planned Task Items ({planItems.length})
            </label>

            {planItems.length === 0 ? (
              <div className="p-6 rounded-2xl bg-dark-950 border border-dark-800 text-center text-xs text-dark-500">
                No tasks were planned for this date.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {planItems.map(item => {
                  const task = tasks.find(t => t.id === item.taskId);
                  const isDone = isTaskCompletedOnDate(item.taskId, selectedDate);
                  const cat = task ? categories.find(c => c.id === task.categoryId) : undefined;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-colors ${
                        isDone
                          ? 'bg-dark-950 border-dark-850 text-dark-400'
                          : 'bg-dark-950 border-dark-800 text-theme-title'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-theme-accent-secondary flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-dark-600 flex-shrink-0" />
                        )}
                        <span className={`font-semibold truncate ${isDone ? 'line-through' : ''}`}>
                          {task ? task.title : 'Deleted Task'}
                        </span>
                      </div>

                      {cat && (
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-semibold border flex-shrink-0"
                          style={{
                            backgroundColor: `${cat.accent}15`,
                            color: cat.accent,
                            borderColor: `${cat.accent}30`,
                          }}
                        >
                          {cat.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
