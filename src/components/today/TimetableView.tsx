import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Task, Category, DailyPlanItem } from '../../types';
import { IconHelper } from '../common/IconHelper';
import { TimeSlotModal } from './TimeSlotModal';
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
  Plus,
  Layers,
} from 'lucide-react';

interface ScheduledSlotData {
  planItem: DailyPlanItem;
  task: Task;
  slotIndex: number;
  totalSlots: number;
}

interface LayoutSlot {
  id: string;
  slotData: ScheduledSlotData;
  startMinutes: number;
  endMinutes: number;
  top: number;
  height: number;
  colIndex: number;
  totalCols: number;
}

interface TimetableViewProps {
  todayDate: string;
  todayPlan: DailyPlanItem[];
  tasks: Task[];
  categories: Category[];
  completions: Record<string, boolean>;
  onToggleComplete: (taskId: string) => void;
  onTogglePlanSlotComplete?: (planItemId: string) => void;
  onAssignTimeSlot: (
    taskId: string,
    startTime: string,
    durationMinutes?: number,
    endTime?: string,
    planItemId?: string
  ) => void;
  onRemoveFromTimeSlot: (planItemIdOrTaskId: string) => void;
  onOpenTaskModal: (task?: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => {
  const h = i < 10 ? `0${i}:00` : `${i}:00`;
  return h;
});

type Quadrant = 'all' | 'morning' | 'afternoon' | 'evening' | 'night';

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Background Droppable Hour Row
const BackgroundHourSlot: React.FC<{
  hour: string;
  hourHeight: number;
  isCurrentHour: boolean;
  onAddSlotForHour: (hour: string) => void;
}> = ({ hour, hourHeight, isCurrentHour, onAddSlotForHour }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `hour-slot-${hour}`,
    data: { timeSlot: hour },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ height: `${hourHeight}px` }}
      className={`relative border-t border-dark-800/80 transition-colors group ${
        isCurrentHour ? 'bg-theme-accent/5' : ''
      } ${isOver ? 'bg-theme-accent/15 ring-2 ring-theme-accent/50 z-10' : ''}`}
    >
      {/* 30-minute faint half-hour guide line */}
      <div
        style={{ top: `${hourHeight / 2}px` }}
        className="absolute left-0 right-0 border-t border-dashed border-dark-800/40 pointer-events-none"
      />

      {/* Hover action to schedule directly on this hour */}
      <div className="absolute right-3 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          type="button"
          onClick={() => onAddSlotForHour(hour)}
          className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-dark-850 hover:bg-dark-800 text-dark-300 hover:text-theme-title text-[11px] font-semibold border border-dark-750 transition-all shadow-sm"
          title={`Schedule slot for ${hour}`}
        >
          <Plus className="w-3 h-3 text-theme-accent" />
          <span>Schedule {hour}</span>
        </button>
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
  onTogglePlanSlotComplete,
  onAssignTimeSlot,
  onRemoveFromTimeSlot,
  onOpenTaskModal,
  onDeleteTask,
}) => {
  const [activeQuadrant, setActiveQuadrant] = useState<Quadrant>('all');
  const [hourHeight, setHourHeight] = useState<number>(80); // 80px per hour default
  const [currentTime, setCurrentTime] = useState<string>('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // TimeSlot Modal State
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  const [activeSlotData, setActiveSlotData] = useState<{
    planItem?: DailyPlanItem;
    taskId?: string;
    startTime?: string;
    durationMinutes?: number;
    endTime?: string;
  } | null>(null);

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

  // Determine quadrant start & end hours
  const { startHour, endHour, displayedHours } = useMemo(() => {
    let sH = 0;
    let eH = 24;
    if (activeQuadrant === 'morning') { sH = 6; eH = 12; }
    else if (activeQuadrant === 'afternoon') { sH = 12; eH = 18; }
    else if (activeQuadrant === 'evening') { sH = 18; eH = 24; }
    else if (activeQuadrant === 'night') { sH = 0; eH = 6; }

    const hours = HOURS_24.filter((_, idx) => idx >= sH && idx < eH);
    return { startHour: sH, endHour: eH, displayedHours: hours };
  }, [activeQuadrant]);

  const viewStartMinutes = startHour * 60;
  const viewEndMinutes = endHour * 60;
  const totalViewHours = endHour - startHour;
  const totalCanvasHeight = totalViewHours * hourHeight;

  // Auto-scroll to current hour on initial load if today
  useEffect(() => {
    if (scrollContainerRef.current && isActuallyToday && currentTime) {
      const currentH = parseInt(currentTime.split(':')[0], 10);
      if (currentH >= startHour && currentH < endHour) {
        const targetScroll = Math.max(0, (currentH - startHour - 1) * hourHeight);
        scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
    }
  }, [activeQuadrant, isActuallyToday]);

  // Track slot counts per task
  const taskSlotCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todayPlan.forEach(p => {
      if (p.startTime || p.timeSlot) {
        counts[p.taskId] = (counts[p.taskId] || 0) + 1;
      }
    });
    return counts;
  }, [todayPlan]);

  // Build scheduled slots list and unassigned list
  const { scheduledSlots, unassignedTasks } = useMemo(() => {
    const scheduled: ScheduledSlotData[] = [];
    const unassigned: Task[] = [];
    const taskIdxMap: Record<string, number> = {};

    todayPlan.forEach(planItem => {
      const task = tasks.find(t => t.id === planItem.taskId);
      if (!task) return;

      const time = planItem.startTime || planItem.timeSlot;
      if (time) {
        taskIdxMap[task.id] = (taskIdxMap[task.id] || 0) + 1;
        scheduled.push({
          planItem,
          task,
          slotIndex: taskIdxMap[task.id],
          totalSlots: taskSlotCounts[task.id] || 1,
        });
      } else {
        if (!unassigned.some(t => t.id === task.id)) {
          unassigned.push(task);
        }
      }
    });

    return { scheduledSlots: scheduled, unassignedTasks: unassigned };
  }, [todayPlan, tasks, taskSlotCounts]);

  // Calculate Google Calendar Proportional Layout (top, height, columns for overlapping blocks)
  const layoutSlots = useMemo<LayoutSlot[]>(() => {
    const visible: LayoutSlot[] = [];

    for (const slotData of scheduledSlots) {
      const sTime = slotData.planItem.startTime || slotData.planItem.timeSlot || '09:00';
      const dur = slotData.planItem.durationMinutes || 60;
      const startMins = timeToMinutes(sTime);
      const endMins = startMins + dur;

      // Check if slot falls into the current quadrant view window
      if (endMins > viewStartMinutes && startMins < viewEndMinutes) {
        const clampedStart = Math.max(startMins, viewStartMinutes);
        const clampedEnd = Math.min(endMins, viewEndMinutes);

        // Calculate proportional top and height
        const top = ((clampedStart - viewStartMinutes) / 60) * hourHeight;
        const rawHeight = ((clampedEnd - clampedStart) / 60) * hourHeight;
        // Minimum height of 28px ensures 15m tasks remain readable
        const height = Math.max(28, rawHeight);

        visible.push({
          id: slotData.planItem.id,
          slotData,
          startMinutes: startMins,
          endMinutes: endMins,
          top,
          height,
          colIndex: 0,
          totalCols: 1,
        });
      }
    }

    // Sort by start time, then duration descending
    visible.sort((a, b) => a.startMinutes - b.startMinutes || (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes));

    // Group into overlap clusters
    const clusters: LayoutSlot[][] = [];
    let currentCluster: LayoutSlot[] = [];
    let clusterEnd = -1;

    for (const item of visible) {
      if (currentCluster.length === 0) {
        currentCluster.push(item);
        clusterEnd = item.endMinutes;
      } else {
        if (item.startMinutes < clusterEnd) {
          currentCluster.push(item);
          clusterEnd = Math.max(clusterEnd, item.endMinutes);
        } else {
          clusters.push(currentCluster);
          currentCluster = [item];
          clusterEnd = item.endMinutes;
        }
      }
    }
    if (currentCluster.length > 0) clusters.push(currentCluster);

    // Assign greedy column positions inside each cluster
    for (const cluster of clusters) {
      const columnEndTimes: number[] = [];
      for (const item of cluster) {
        let placedCol = -1;
        for (let c = 0; c < columnEndTimes.length; c++) {
          if (columnEndTimes[c] <= item.startMinutes) {
            placedCol = c;
            columnEndTimes[c] = item.endMinutes;
            break;
          }
        }
        if (placedCol === -1) {
          placedCol = columnEndTimes.length;
          columnEndTimes.push(item.endMinutes);
        }
        item.colIndex = placedCol;
      }
      const totalCols = Math.max(1, columnEndTimes.length);
      for (const item of cluster) {
        item.totalCols = totalCols;
      }
    }

    return visible;
  }, [scheduledSlots, viewStartMinutes, viewEndMinutes, hourHeight]);

  // Calculate Real-Time NOW indicator position
  const nowIndicatorTop = useMemo<number | null>(() => {
    if (!isActuallyToday || !currentTime) return null;
    const nowMins = timeToMinutes(currentTime);
    if (nowMins < viewStartMinutes || nowMins > viewEndMinutes) return null;
    return ((nowMins - viewStartMinutes) / 60) * hourHeight;
  }, [isActuallyToday, currentTime, viewStartMinutes, viewEndMinutes, hourHeight]);

  // Modal Triggers
  const handleOpenEditSlot = (planItem: DailyPlanItem, task: Task) => {
    setActiveSlotData({
      planItem,
      taskId: task.id,
      startTime: planItem.startTime || planItem.timeSlot || '09:00',
      durationMinutes: planItem.durationMinutes || 60,
      endTime: planItem.endTime,
    });
    setIsSlotModalOpen(true);
  };

  const handleAddSlotForHour = (hour: string) => {
    setActiveSlotData({
      startTime: hour,
      durationMinutes: 60,
    });
    setIsSlotModalOpen(true);
  };

  const handleDuplicateSlot = (task: Task) => {
    setActiveSlotData({
      taskId: task.id,
      startTime: '14:00',
      durationMinutes: 60,
    });
    setIsSlotModalOpen(true);
  };

  const handleScheduleUnassignedTask = (task: Task) => {
    setActiveSlotData({
      taskId: task.id,
      startTime: '09:00',
      durationMinutes: 60,
    });
    setIsSlotModalOpen(true);
  };

  const handleSaveSlotModal = (
    taskId: string,
    startTime: string,
    durationMinutes: number,
    endTime: string,
    planItemId?: string
  ) => {
    onAssignTimeSlot(taskId, startTime, durationMinutes, endTime, planItemId);
  };

  const priorityColors = {
    low: 'bg-dark-800 text-dark-500 border-dark-750',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      {/* Top Toolbar: Quadrants, Zoom Presets, Add Slot & Real Time */}
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

        <div className="flex items-center space-x-2">
          {/* Calendar Height / Scale Zoom Selector */}
          <div className="hidden md:flex items-center space-x-1 bg-dark-950 p-0.5 rounded-xl border border-dark-800 text-[10px] font-mono">
            <button
              onClick={() => setHourHeight(60)}
              className={`px-2 py-1 rounded-lg transition-colors ${
                hourHeight === 60 ? 'bg-dark-800 text-theme-title font-bold' : 'text-dark-500 hover:text-dark-300'
              }`}
              title="Compact View (60px/hr)"
            >
              Compact
            </button>
            <button
              onClick={() => setHourHeight(80)}
              className={`px-2 py-1 rounded-lg transition-colors ${
                hourHeight === 80 ? 'bg-dark-800 text-theme-title font-bold' : 'text-dark-500 hover:text-dark-300'
              }`}
              title="Standard View (80px/hr)"
            >
              Standard
            </button>
            <button
              onClick={() => setHourHeight(100)}
              className={`px-2 py-1 rounded-lg transition-colors ${
                hourHeight === 100 ? 'bg-dark-800 text-theme-title font-bold' : 'text-dark-500 hover:text-dark-300'
              }`}
              title="Spacious View (100px/hr)"
            >
              Spacious
            </button>
          </div>

          {/* Add Custom Slot Button */}
          <button
            type="button"
            onClick={() => {
              setActiveSlotData(null);
              setIsSlotModalOpen(true);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-theme-accent text-white text-xs font-bold hover:bg-theme-accent-hover shadow-glow-accent transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Custom Slot</span>
          </button>

          {isActuallyToday && currentTime && (
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-theme-accent font-mono font-bold px-2.5 py-1 bg-theme-accent/10 border border-theme-accent/20 rounded-xl">
              <Clock className="w-3 h-3" />
              <span>{currentTime}</span>
            </div>
          )}
        </div>
      </div>

      {/* Unscheduled Tasks in Today's Plan */}
      {unassignedTasks.length > 0 && (
        <div className="bg-dark-900 border border-dark-800 rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-dark-300">
              Unscheduled in Timetable ({unassignedTasks.length})
            </span>
            <span className="text-[11px] text-dark-500">
              Drag into any hour or click "+ Time"
            </span>
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
                  <button
                    type="button"
                    onClick={() => handleScheduleUnassignedTask(task)}
                    className="ml-1 text-[10px] text-theme-accent hover:underline flex items-center space-x-0.5"
                    title="Assign custom time slot"
                  >
                    <Clock className="w-2.5 h-2.5" />
                    <span>Time</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GOOGLE CALENDAR PROPORTIONAL TIMELINE VIEW */}
      <div
        ref={scrollContainerRef}
        className="flex-1 bg-dark-900/90 border border-dark-800 rounded-3xl overflow-hidden shadow-xl max-h-[calc(100vh-270px)] overflow-y-auto relative scrollbar-none select-none"
      >
        <div className="flex items-stretch min-w-[340px]" style={{ height: `${totalCanvasHeight}px` }}>
          {/* Left Hour Axis Column */}
          <div className="w-16 sm:w-20 flex-shrink-0 border-r border-dark-800/80 bg-dark-950/80 z-10 flex flex-col select-none">
            {displayedHours.map((hour, idx) => {
              const currentHourNum = currentTime ? parseInt(currentTime.split(':')[0], 10) : -1;
              const slotHourNum = parseInt(hour.split(':')[0], 10);
              const isCurrentHour = isActuallyToday && currentHourNum === slotHourNum;

              return (
                <div
                  key={hour}
                  style={{ height: `${hourHeight}px` }}
                  className={`relative flex flex-col items-center justify-start pt-2 px-1 border-t ${
                    idx === 0 ? 'border-transparent' : 'border-dark-800/80'
                  }`}
                >
                  <span
                    className={`text-xs font-mono font-bold ${
                      isCurrentHour ? 'text-theme-accent' : 'text-dark-400'
                    }`}
                  >
                    {hour}
                  </span>

                  {/* Half-hour marker label */}
                  <span
                    style={{ top: `${hourHeight / 2 - 7}px` }}
                    className="absolute text-[9px] font-mono text-dark-600"
                  >
                    :30
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right Calendar Canvas: Grid Background + Proportional Blocks + Realtime Line */}
          <div className="flex-1 relative bg-dark-900/50">
            {/* Background Droppable Hour Rows */}
            <div className="absolute inset-0 z-0 flex flex-col">
              {displayedHours.map(hour => {
                const currentHourNum = currentTime ? parseInt(currentTime.split(':')[0], 10) : -1;
                const slotHourNum = parseInt(hour.split(':')[0], 10);
                const isCurrentHour = isActuallyToday && currentHourNum === slotHourNum;

                return (
                  <BackgroundHourSlot
                    key={hour}
                    hour={hour}
                    hourHeight={hourHeight}
                    isCurrentHour={isCurrentHour}
                    onAddSlotForHour={handleAddSlotForHour}
                  />
                );
              })}
            </div>

            {/* Red/Blue Realtime NOW Indicator Line */}
            {nowIndicatorTop !== null && (
              <div
                style={{ top: `${nowIndicatorTop}px` }}
                className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-theme-accent shadow-glow-accent -ml-1.5" />
                <div className="flex-1 h-[2px] bg-theme-accent shadow-glow-accent opacity-90" />
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-theme-accent text-white mr-2">
                  {currentTime}
                </span>
              </div>
            )}

            {/* Proportional Scheduled Event Blocks (Google Calendar Style) */}
            {layoutSlots.map(item => {
              const { planItem, task, slotIndex, totalSlots } = item.slotData;
              const category = categories.find(c => c.id === task.categoryId);
              const isCompleted =
                planItem.completed !== undefined
                  ? planItem.completed
                  : !!completions[task.id];

              const startTimeDisplay = planItem.startTime || planItem.timeSlot || '09:00';
              const endTimeDisplay = planItem.endTime;
              const durationDisplay = planItem.durationMinutes || 60;

              const isShort = item.height < 40; // 15m - 25m
              const isMedium = item.height >= 40 && item.height < 70; // 30m - 50m
              const isTall = item.height >= 70; // 1h - 2h+

              const accentColor = category?.accent || '#3b82f6';

              const handleToggle = (e: React.MouseEvent) => {
                e.stopPropagation();
                if (onTogglePlanSlotComplete) {
                  onTogglePlanSlotComplete(planItem.id);
                } else {
                  onToggleComplete(task.id);
                }
              };

              const leftPercent = (item.colIndex / item.totalCols) * 100;
              const widthPercent = 100 / item.totalCols;

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenEditSlot(planItem, task)}
                  style={{
                    top: `${item.top}px`,
                    height: `${item.height}px`,
                    left: `calc(${leftPercent}% + 3px)`,
                    width: `calc(${widthPercent}% - 6px)`,
                    backgroundColor: `${accentColor}18`,
                    borderLeftColor: accentColor,
                    borderColor: `${accentColor}40`,
                  }}
                  className={`absolute rounded-xl border border-l-4 p-2 transition-all duration-200 cursor-pointer overflow-hidden z-20 group hover:z-30 hover:shadow-xl hover:border-l-[5px] ${
                    isCompleted ? 'opacity-60 bg-dark-950/60' : 'shadow-sm hover:brightness-110'
                  }`}
                  title={`${task.title} (${startTimeDisplay} – ${endTimeDisplay || ''})`}
                >
                  {/* Ultra Short Event (15m - 25m) */}
                  {isShort && (
                    <div className="h-full flex items-center justify-between space-x-1.5 text-xs -mt-1">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={handleToggle}
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                            isCompleted
                              ? 'bg-emerald-500 border-emerald-500 text-dark-950'
                              : 'border-dark-500 hover:border-theme-accent'
                          }`}
                        >
                          {isCompleted && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </button>
                        <span
                          className={`font-semibold truncate text-[11px] ${
                            isCompleted ? 'line-through text-dark-500' : 'text-theme-title'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 flex-shrink-0 text-[10px] font-mono text-dark-400">
                        <span>{startTimeDisplay}</span>
                        <span className="text-dark-500">({durationDisplay}m)</span>
                      </div>
                    </div>
                  )}

                  {/* Medium Event (30m - 50m) */}
                  {isMedium && (
                    <div className="h-full flex flex-col justify-between text-xs">
                      <div className="flex items-center justify-between space-x-1 min-w-0">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <button
                            type="button"
                            onClick={handleToggle}
                            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                              isCompleted
                                ? 'bg-emerald-500 border-emerald-500 text-dark-950'
                                : 'border-dark-500 hover:border-theme-accent'
                            }`}
                          >
                            {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <span
                            className={`font-semibold truncate text-xs ${
                              isCompleted ? 'line-through text-dark-500' : 'text-theme-title'
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>

                        {/* Hover Quick Actions */}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleDuplicateSlot(task);
                            }}
                            className="p-0.5 rounded text-dark-400 hover:text-purple-400"
                            title="Add another slot today"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onRemoveFromTimeSlot(planItem.id);
                            }}
                            className="p-0.5 rounded text-dark-400 hover:text-amber-400"
                            title="Remove slot"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 text-[10px] font-mono text-dark-300">
                        <span className="flex items-center space-x-0.5">
                          <Clock className="w-2.5 h-2.5 text-theme-accent" />
                          <span>
                            {startTimeDisplay} – {endTimeDisplay}
                          </span>
                        </span>
                        <span className="text-dark-500">({durationDisplay}m)</span>
                        {totalSlots > 1 && (
                          <span className="text-purple-400 font-bold">
                            #{slotIndex}/{totalSlots}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tall Event (1h, 2h, 3h+) */}
                  {isTall && (
                    <div className="h-full flex flex-col justify-between text-xs space-y-1.5">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between space-x-1">
                          <div className="flex items-center space-x-2 min-w-0">
                            <button
                              type="button"
                              onClick={handleToggle}
                              className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                                isCompleted
                                  ? 'bg-emerald-500 border-emerald-500 text-dark-950 shadow-glow-emerald'
                                  : 'border-dark-500 hover:border-theme-accent'
                              }`}
                            >
                              {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                            <span
                              className={`font-bold truncate text-xs sm:text-sm ${
                                isCompleted ? 'line-through text-dark-500' : 'text-theme-title'
                              }`}
                            >
                              {task.title}
                            </span>
                          </div>

                          {/* Action icons */}
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                handleDuplicateSlot(task);
                              }}
                              className="p-1 rounded bg-dark-950/80 text-dark-400 hover:text-purple-400"
                              title="Add another slot today"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onOpenTaskModal(task);
                              }}
                              className="p-1 rounded bg-dark-950/80 text-dark-400 hover:text-theme-title"
                              title="Edit task details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onRemoveFromTimeSlot(planItem.id);
                              }}
                              className="p-1 rounded bg-dark-950/80 text-dark-400 hover:text-amber-400"
                              title="Remove slot"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onDeleteTask(task.id);
                              }}
                              className="p-1 rounded bg-dark-950/80 text-dark-400 hover:text-rose-400"
                              title="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Metadata badges: Category, Multi-slot, Priority */}
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          {totalSlots > 1 && (
                            <span className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              <Layers className="w-2.5 h-2.5" />
                              <span>
                                Slot {slotIndex} of {totalSlots}
                              </span>
                            </span>
                          )}

                          {category && (
                            <span
                              className="inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9px] font-semibold border"
                              style={{
                                backgroundColor: `${category.accent}20`,
                                color: category.accent,
                                borderColor: `${category.accent}40`,
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

                        {task.notes && (
                          <p className="text-[11px] text-dark-400 line-clamp-2 italic">
                            {task.notes}
                          </p>
                        )}
                      </div>

                      {/* Bottom Time Pill */}
                      <div className="flex items-center justify-between pt-1 border-t border-dark-800/40 text-[10px] font-mono">
                        <span className="flex items-center space-x-1 text-theme-accent font-bold">
                          <Clock className="w-3 h-3" />
                          <span>
                            {startTimeDisplay} – {endTimeDisplay}
                          </span>
                        </span>
                        <span className="text-dark-400 px-1.5 py-0.2 rounded bg-dark-950/60 border border-dark-800">
                          {durationDisplay} mins
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time Slot Modal */}
      <TimeSlotModal
        isOpen={isSlotModalOpen}
        onClose={() => {
          setIsSlotModalOpen(false);
          setActiveSlotData(null);
        }}
        onSave={handleSaveSlotModal}
        tasks={tasks}
        categories={categories}
        todayPlan={todayPlan}
        initialSlot={activeSlotData}
      />
    </div>
  );
};
