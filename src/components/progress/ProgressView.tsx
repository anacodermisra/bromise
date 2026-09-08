import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { getHeatmapDataRange, getAccountStartDate, getStreakInfo, getDayStats, formatDateKey } from '../../utils/storage';
import type { Category, Task, HeatmapItem } from '../../types';
import { Flame, Trophy, CheckCircle2, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { IconHelper } from '../common/IconHelper';

interface ProgressViewProps {
  categories: Category[];
  tasks: Task[];
}

type ViewPreset = 'month' | 'last_month' | '6_months' | 'year' | 'all_time';

export const ProgressView: React.FC<ProgressViewProps> = ({ categories, tasks }) => {
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [viewPreset, setViewPreset] = useState<ViewPreset>('year');
  const [periodOffset, setPeriodOffset] = useState<number>(0);
  const [hoveredDay, setHoveredDay] = useState<HeatmapItem | null>(null);

  const streakInfo = getStreakInfo();
  const accountStart = getAccountStartDate();

  // Compute date range based on viewPreset and periodOffset
  const getHeatmapPeriod = () => {
    const today = new Date();

    let startDateStr = '';
    let endDateStr = '';
    let rangeTitle = '';

    if (viewPreset === 'month' || viewPreset === 'last_month') {
      const effectiveOffset = viewPreset === 'last_month' ? periodOffset + 1 : periodOffset;
      const targetMonthDate = new Date(today.getFullYear(), today.getMonth() - effectiveOffset, 1);
      const year = targetMonthDate.getFullYear();
      const month = targetMonthDate.getMonth();

      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      startDateStr = formatDateKey(firstDay);
      endDateStr = formatDateKey(lastDay);
      rangeTitle = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });
    } else if (viewPreset === '6_months') {
      const endMonthDate = new Date(today.getFullYear(), today.getMonth() - periodOffset, 1);
      const endYear = endMonthDate.getFullYear();
      const endMonth = endMonthDate.getMonth();

      const lastDay = periodOffset === 0 ? today : new Date(endYear, endMonth + 1, 0);
      const firstDay = new Date(endYear, endMonth - 5, 1);

      startDateStr = formatDateKey(firstDay);
      endDateStr = formatDateKey(lastDay);

      const startLabel = firstDay.toLocaleString('default', { month: 'short', year: 'numeric' });
      const endLabel = endMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
      rangeTitle = `${startLabel} – ${endLabel}`;
    } else if (viewPreset === 'year') {
      const endMonthDate = new Date(today.getFullYear(), today.getMonth() - periodOffset, 1);
      const endYear = endMonthDate.getFullYear();
      const endMonth = endMonthDate.getMonth();

      const lastDay = periodOffset === 0 ? today : new Date(endYear, endMonth + 1, 0);
      const firstDay = new Date(endYear, endMonth - 11, 1);

      startDateStr = formatDateKey(firstDay);
      endDateStr = formatDateKey(lastDay);

      const startLabel = firstDay.toLocaleString('default', { month: 'short', year: 'numeric' });
      const endLabel = endMonthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
      rangeTitle = `${startLabel} – ${endLabel}`;
    } else if (viewPreset === 'all_time') {
      if (periodOffset === 0) {
        startDateStr = accountStart;
        endDateStr = formatDateKey(today);
        const startYear = accountStart.substring(0, 4);
        const currentYear = today.getFullYear().toString();
        rangeTitle = startYear === currentYear ? `All Time (${startYear})` : `All Time (${startYear} – ${currentYear})`;
      } else {
        const endYear = today.getFullYear() - periodOffset;
        const firstDay = new Date(endYear, 0, 1);
        const lastDay = new Date(endYear, 11, 31);
        const candidateStart = formatDateKey(firstDay);
        startDateStr = candidateStart < accountStart ? accountStart : candidateStart;
        endDateStr = formatDateKey(lastDay);
        rangeTitle = `Year ${endYear}`;
      }
    }

    return { startDateStr, endDateStr, rangeTitle };
  };

  const { startDateStr, endDateStr, rangeTitle } = getHeatmapPeriod();
  const heatmapDays = getHeatmapDataRange(startDateStr, endDateStr);

  const isNextDisabled = periodOffset === 0;
  const isPrevDisabled = startDateStr <= accountStart;

  const handlePrevPeriod = () => {
    if (!isPrevDisabled) setPeriodOffset(prev => prev + 1);
  };

  const handleNextPeriod = () => {
    if (!isNextDisabled) setPeriodOffset(prev => Math.max(0, prev - 1));
  };

  const handlePresetChange = (preset: ViewPreset) => {
    setViewPreset(preset);
    setPeriodOffset(0);
  };

  const getHeatmapColor = (pct: number, planned: number, isPadding?: boolean) => {
    if (isPadding) return 'transparent';
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

      <div className="p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold text-theme-title font-sans">Activity Heatmap</h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-theme-accent/15 text-theme-accent border border-theme-accent/30">
                {rangeTitle}
              </span>
            </div>
            <p className="text-xs text-dark-500 mt-0.5">
              Account active since <strong className="text-dark-300">{accountStart}</strong> • Hover over tiles for details
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1 bg-dark-950 p-1 rounded-xl border border-dark-800">
              <button
                onClick={handlePrevPeriod}
                disabled={isPrevDisabled}
                className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-theme-title disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Earlier period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-dark-300 px-2 min-w-[90px] text-center select-none">
                {rangeTitle}
              </span>
              <button
                onClick={handleNextPeriod}
                disabled={isNextDisabled}
                className="p-1.5 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-theme-title disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Later period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center bg-dark-950 p-1 rounded-xl border border-dark-800 space-x-1 text-xs font-medium overflow-x-auto">
              <button
                onClick={() => handlePresetChange('month')}
                className={`px-2.5 py-1 rounded-lg transition-all ${viewPreset === 'month' ? 'bg-theme-accent text-white font-bold shadow' : 'text-dark-400 hover:text-theme-title'}`}
              >
                Current Month
              </button>
              <button
                onClick={() => handlePresetChange('last_month')}
                className={`px-2.5 py-1 rounded-lg transition-all ${viewPreset === 'last_month' ? 'bg-theme-accent text-white font-bold shadow' : 'text-dark-400 hover:text-theme-title'}`}
              >
                Last Month
              </button>
              <button
                onClick={() => handlePresetChange('6_months')}
                className={`px-2.5 py-1 rounded-lg transition-all ${viewPreset === '6_months' ? 'bg-theme-accent text-white font-bold shadow' : 'text-dark-400 hover:text-theme-title'}`}
              >
                Past 6 Months
              </button>
              <button
                onClick={() => handlePresetChange('year')}
                className={`px-2.5 py-1 rounded-lg transition-all ${viewPreset === 'year' ? 'bg-theme-accent text-white font-bold shadow' : 'text-dark-400 hover:text-theme-title'}`}
              >
                Last Year
              </button>
              <button
                onClick={() => handlePresetChange('all_time')}
                className={`px-2.5 py-1 rounded-lg transition-all ${viewPreset === 'all_time' ? 'bg-theme-accent text-white font-bold shadow' : 'text-dark-400 hover:text-theme-title'}`}
              >
                All Time
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-start space-x-2 overflow-x-auto pb-2 scrollbar-none">
          <div className="grid grid-rows-7 gap-1.5 text-[10px] font-semibold text-dark-500 pt-0.5 select-none shrink-0">
            <span className="h-3.5 leading-3.5">Sun</span>
            <span className="h-3.5 leading-3.5">Mon</span>
            <span className="h-3.5 leading-3.5">Tue</span>
            <span className="h-3.5 leading-3.5">Wed</span>
            <span className="h-3.5 leading-3.5">Thu</span>
            <span className="h-3.5 leading-3.5">Fri</span>
            <span className="h-3.5 leading-3.5">Sat</span>
          </div>

          <div className="inline-grid grid-rows-7 grid-flow-col gap-1.5 min-w-[300px]">
            {heatmapDays.map((day, idx) => (
              day.isPadding ? (
                <div key={`pad-${idx}`} className="w-3.5 h-3.5 rounded-sm opacity-0 pointer-events-none" />
              ) : (
                <div
                  key={day.date}
                  onMouseEnter={() => setHoveredDay(day)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className="w-3.5 h-3.5 rounded-sm transition-transform hover:scale-125 cursor-pointer relative"
                  style={{ backgroundColor: getHeatmapColor(day.percentage, day.plannedCount, day.isPadding) }}
                />
              )
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="h-6 text-xs text-dark-400 font-medium">
            {hoveredDay && !hoveredDay.isPadding ? (
              <span className="text-theme-accent">
                📅 <strong>{hoveredDay.date}</strong> — Completion: <strong>{hoveredDay.percentage}%</strong> ({hoveredDay.completedCount}/{hoveredDay.plannedCount} tasks)
              </span>
            ) : (
              <span className="text-dark-500 italic">Hover over any day tile for details...</span>
            )}
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
