import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { getHeatmapData, getStreakInfo, getDayStats, formatDateKey } from '../../utils/storage';
import type { Category, Task } from '../../types';
import { Flame, Trophy, CheckCircle2, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { IconHelper } from '../common/IconHelper';

interface ProgressViewProps {
  categories: Category[];
  tasks: Task[];
}

export const ProgressView: React.FC<ProgressViewProps> = ({ categories, tasks }) => {
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [hoveredDay, setHoveredDay] = useState<{ date: string; pct: number; planned: number; completed: number } | null>(null);

  const streakInfo = getStreakInfo();
  const heatmapDays = getHeatmapData(364);

  const getHeatmapColor = (pct: number, planned: number) => {
    if (planned === 0) return 'rgb(var(--border-color))';
    if (pct === 0) return 'rgb(var(--border-strong))';
    if (pct < 40) return '#064e3b';
    if (pct < 70) return '#047857';
    if (pct < 95) return '#10b981';
    return '#34d399';
  };

  const getWeeklyData = () => {
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const distanceToMonday = (currentDayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday - weekOffset * 7);

    const weekDays = [];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = formatDateKey(d);
      const stats = getDayStats(dateStr);

      weekDays.push({
        dayName: dayNames[i],
        dateStr,
        percentage: stats.percentage,
        completed: stats.completedCount,
        planned: stats.plannedCount,
      });
    }

    const avgPct = Math.round(weekDays.reduce((acc, curr) => acc + curr.percentage, 0) / 7);
    const totalPlanned = weekDays.reduce((acc, curr) => acc + curr.planned, 0);
    const totalCompleted = weekDays.reduce((acc, curr) => acc + curr.completed, 0);

    return { weekDays, avgPct, totalPlanned, totalCompleted, mondayStr: weekDays[0].dateStr, sundayStr: weekDays[6].dateStr };
  };

  const { weekDays, avgPct, totalPlanned, totalCompleted, mondayStr, sundayStr } = getWeeklyData();

  const categoryStats = categories.map(cat => {
    const catTasks = tasks.filter(t => t.categoryId === cat.id);
    return {
      name: cat.name,
      accent: cat.accent,
      icon: cat.icon,
      count: catTasks.length,
    };
  });

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="space-y-1">
        <div className="flex items-center space-x-2 text-xs font-semibold text-theme-accent-secondary uppercase tracking-widest">
          <TrendingUp className="w-4 h-4" />
          <span>Analytics & Progress Engine</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-theme-title font-sans">
          Historical Momentum & Performance
        </h2>
        <p className="text-sm text-dark-500">
          Track your active execution streaks, weekly completion velocity, and long-term activity.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-tr from-dark-900 via-dark-850 to-dark-900 border border-dark-800 space-y-2 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-theme-title font-sans">{streakInfo.currentStreak} Days</div>
            <div className="text-xs text-dark-500">Current Execution Streak</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-tr from-dark-900 via-dark-850 to-dark-900 border border-dark-800 space-y-2 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-theme-accent/10 border border-theme-accent/20 text-theme-accent flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-theme-title font-sans">{streakInfo.bestStreak} Days</div>
            <div className="text-xs text-dark-500">All-Time Best Streak</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-tr from-dark-900 via-dark-850 to-dark-900 border border-dark-800 space-y-2 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-theme-title font-sans">{avgPct}%</div>
            <div className="text-xs text-dark-500">Weekly Avg Completion Rate</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-tr from-dark-900 via-dark-850 to-dark-900 border border-dark-800 space-y-2 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-theme-title font-sans">{streakInfo.totalCompletedTasks}</div>
            <div className="text-xs text-dark-500">Total Completed Execution Items</div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-theme-title font-sans">Activity Heatmap (Past 12 Months)</h3>
            <p className="text-xs text-dark-500">Hover over any tile to view date & completion percentage.</p>
          </div>
          <div className="flex items-center space-x-2 text-[11px] text-dark-500">
            <span>Low</span>
            <div className="flex space-x-1">
              <div className="w-3 h-3 rounded bg-[#1c2030]" />
              <div className="w-3 h-3 rounded bg-[#064e3b]" />
              <div className="w-3 h-3 rounded bg-[#047857]" />
              <div className="w-3 h-3 rounded bg-[#10b981]" />
              <div className="w-3 h-3 rounded bg-[#34d399]" />
            </div>
            <span>High</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2 scrollbar-none">
          <div className="inline-grid grid-rows-7 grid-flow-col gap-1.5 min-w-[700px]">
            {heatmapDays.map((day) => (
              <div
                key={day.date}
                onMouseEnter={() =>
                  setHoveredDay({
                    date: day.date,
                    pct: day.percentage,
                    planned: day.plannedCount,
                    completed: day.completedCount,
                  })
                }
                onMouseLeave={() => setHoveredDay(null)}
                className="w-3.5 h-3.5 rounded-sm transition-transform hover:scale-125 cursor-pointer relative"
                style={{ backgroundColor: getHeatmapColor(day.percentage, day.plannedCount) }}
              />
            ))}
          </div>
        </div>

        <div className="h-6 text-xs text-dark-400 font-medium">
          {hoveredDay ? (
            <span className="text-theme-accent">
              📅 <strong>{hoveredDay.date}</strong> — Completion: <strong>{hoveredDay.pct}%</strong> ({hoveredDay.completed}/{hoveredDay.planned} tasks)
            </span>
          ) : (
            <span className="text-dark-500 italic">Hover over any day tile for details...</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-theme-title font-sans">Weekly Daily Completion</h3>
              <p className="text-xs text-dark-500">
                {mondayStr} to {sundayStr} ({totalCompleted}/{totalPlanned} tasks)
              </p>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-theme-title transition-colors"
                title="Previous week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
                disabled={weekOffset === 0}
                className={`p-1.5 rounded-lg transition-colors ${
                  weekOffset === 0
                    ? 'bg-dark-950 text-dark-700 cursor-not-allowed'
                    : 'bg-dark-800 hover:bg-dark-750 text-dark-400 hover:text-theme-title'
                }`}
                title="Next week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekDays} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="dayName" stroke="#5a6794" fontSize={11} tickLine={false} />
                <YAxis stroke="#5a6794" fontSize={11} domain={[0, 100]} unit="%" tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-dark-950 border border-dark-800 p-2.5 rounded-xl text-xs space-y-1 shadow-xl">
                          <div className="font-bold text-theme-title">{data.dayName} ({data.dateStr})</div>
                          <div className="text-theme-accent-secondary font-semibold">{data.percentage}% Completed</div>
                          <div className="text-dark-500">{data.completed} of {data.planned} tasks</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="percentage" radius={[8, 8, 0, 0]}>
                  {weekDays.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.percentage === 100 ? 'rgb(var(--accent-secondary))' : entry.percentage > 50 ? 'rgb(var(--accent-primary))' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-4">
          <div>
            <h3 className="text-lg font-bold text-theme-title font-sans">Category Directory Distribution</h3>
            <p className="text-xs text-dark-500">Active tasks grouped by category.</p>
          </div>

          <div className="space-y-3 pt-2">
            {categoryStats.map(cat => (
              <div key={cat.name} className="flex items-center justify-between p-3 rounded-2xl bg-dark-950 border border-dark-800">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center border"
                    style={{ backgroundColor: `${cat.accent}15`, borderColor: `${cat.accent}30` }}
                  >
                    <IconHelper name={cat.icon} className="w-3.5 h-3.5" style={{ color: cat.accent }} />
                  </div>
                  <span className="text-xs font-bold text-theme-title">{cat.name}</span>
                </div>
                <span className="text-xs font-bold text-dark-400 px-2.5 py-1 rounded-lg bg-dark-850">
                  {cat.count} tasks
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
