import React, { useState, useEffect } from 'react';
import type { Task, Category, DailyPlanItem } from '../../types';
import { X, Clock, Check, AlertCircle } from 'lucide-react';
import { calculateEndTime, calculateDurationMinutes } from '../../utils/storage';

interface TimeSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    taskId: string,
    startTime: string,
    durationMinutes: number,
    endTime: string,
    planItemId?: string
  ) => void;
  tasks: Task[];
  categories: Category[];
  todayPlan: DailyPlanItem[];
  initialSlot?: {
    planItem?: DailyPlanItem;
    taskId?: string;
    startTime?: string;
    durationMinutes?: number;
    endTime?: string;
  } | null;
}

const PRESET_DURATIONS = [
  { label: '15m', mins: 15 },
  { label: '30m', mins: 30 },
  { label: '45m', mins: 45 },
  { label: '1h', mins: 60 },
  { label: '1.5h', mins: 90 },
  { label: '2h', mins: 120 },
  { label: '3h', mins: 180 },
];

export const TimeSlotModal: React.FC<TimeSlotModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tasks,
  categories,
  todayPlan,
  initialSlot,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [duration, setDuration] = useState<number>(60);
  const [endTime, setEndTime] = useState<string>('10:00');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    if (initialSlot) {
      setSelectedTaskId(initialSlot.taskId || tasks[0]?.id || '');
      const s = initialSlot.startTime || '09:00';
      const d = initialSlot.durationMinutes || 60;
      setStartTime(s);
      setDuration(d);
      setEndTime(initialSlot.endTime || calculateEndTime(s, d));
    } else {
      setSelectedTaskId(tasks[0]?.id || '');
      setStartTime('09:00');
      setDuration(60);
      setEndTime('10:00');
    }
    setSearchQuery('');
  }, [isOpen, initialSlot, tasks]);

  if (!isOpen) return null;

  const handleStartTimeChange = (newStart: string) => {
    setStartTime(newStart);
    setEndTime(calculateEndTime(newStart, duration));
  };

  const handleDurationSelect = (mins: number) => {
    const safeMins = Math.max(5, mins);
    setDuration(safeMins);
    setEndTime(calculateEndTime(startTime, safeMins));
  };

  const handleEndTimeChange = (newEnd: string) => {
    setEndTime(newEnd);
    const calculatedDur = calculateDurationMinutes(startTime, newEnd);
    setDuration(calculatedDur);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId || !startTime) return;
    onSave(
      selectedTaskId,
      startTime,
      duration,
      endTime,
      initialSlot?.planItem?.id
    );
    onClose();
  };

  const existingSlotsForSelectedTask = todayPlan.filter(
    p => p.taskId === selectedTaskId && (p.startTime || p.timeSlot) && p.id !== initialSlot?.planItem?.id
  );

  const filteredTasks = tasks.filter(t =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const selectedCategory = selectedTask ? categories.find(c => c.id === selectedTask.categoryId) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 border border-dark-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-dark-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-theme-accent/15 border border-theme-accent/30 text-theme-accent flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-theme-title font-sans">
                {initialSlot?.planItem ? 'Edit Time Schedule' : 'Schedule Custom Time Slot'}
              </h3>
              <p className="text-xs text-dark-500">
                Set duration from 15 minutes to multiple hours.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-dark-500 hover:text-theme-title hover:bg-dark-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Task Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">
              Select Task
            </label>
            {initialSlot?.planItem ? (
              <div className="p-3 rounded-xl bg-dark-950 border border-dark-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {selectedCategory && (
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: selectedCategory.accent }}
                    />
                  )}
                  <span className="text-xs font-bold text-theme-title">{selectedTask?.title}</span>
                </div>
                <span className="text-[10px] text-dark-500 font-mono">Editing Slot</span>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Filter tasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-dark-950 border border-dark-800 rounded-xl px-3 py-1.5 text-xs text-theme-title placeholder-dark-600 focus:outline-none focus:border-theme-accent transition-colors"
                />
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 scrollbar-none">
                  {filteredTasks.map(t => {
                    const cat = categories.find(c => c.id === t.categoryId);
                    const isSelected = selectedTaskId === t.id;
                    const existingCount = todayPlan.filter(p => p.taskId === t.id && (p.startTime || p.timeSlot)).length;

                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-left border text-xs transition-all ${
                          isSelected
                            ? 'bg-dark-800 border-theme-accent text-theme-title'
                            : 'bg-dark-950 border-dark-800/80 text-dark-400 hover:border-dark-700 hover:text-theme-title'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          {cat && (
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.accent }}
                            />
                          )}
                          <span className="truncate font-medium">{t.title}</span>
                        </div>
                        {existingCount > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-dark-900 border border-dark-800 text-theme-accent flex-shrink-0 ml-2">
                            {existingCount} {existingCount === 1 ? 'slot' : 'slots'} today
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Notice if task already has existing slot(s) today */}
          {existingSlotsForSelectedTask.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Multiple Slots in One Day:</span> This activity is already scheduled at{' '}
                <span className="font-mono font-bold">
                  {existingSlotsForSelectedTask.map(s => `${s.startTime || s.timeSlot}`).join(', ')}
                </span>
                . Saving will add an <strong>additional session</strong> for this same task.
              </div>
            </div>
          )}

          {/* Time & Duration Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Start Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-dark-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-theme-accent" />
                <span>Start Time</span>
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={e => handleStartTimeChange(e.target.value)}
                className="w-full bg-dark-950 border border-dark-800 rounded-xl px-3 py-2 text-sm text-theme-title focus:outline-none focus:border-theme-accent font-mono"
              />
            </div>

            {/* End Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-dark-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-theme-accent-secondary" />
                <span>End Time</span>
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={e => handleEndTimeChange(e.target.value)}
                className="w-full bg-dark-950 border border-dark-800 rounded-xl px-3 py-2 text-sm text-theme-title focus:outline-none focus:border-theme-accent font-mono"
              />
            </div>
          </div>

          {/* Duration Presets + Custom Minute Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-dark-300 uppercase tracking-wider">Duration</span>
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  min={5}
                  max={720}
                  step={5}
                  value={duration}
                  onChange={e => handleDurationSelect(Number(e.target.value))}
                  className="w-16 bg-dark-950 border border-dark-750 rounded-lg px-2 py-0.5 text-xs text-center font-mono text-theme-accent font-bold focus:outline-none focus:border-theme-accent"
                />
                <span className="text-dark-500 font-mono text-xs">mins</span>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {PRESET_DURATIONS.map(p => (
                <button
                  type="button"
                  key={p.mins}
                  onClick={() => handleDurationSelect(p.mins)}
                  className={`py-1.5 rounded-xl border text-xs font-bold font-mono transition-all ${
                    duration === p.mins
                      ? 'bg-theme-accent text-white border-theme-accent shadow-glow-accent'
                      : 'bg-dark-950 border-dark-800 text-dark-400 hover:text-theme-title hover:border-dark-750'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Slot Summary Card */}
          <div className="p-3 rounded-2xl bg-dark-950 border border-dark-800 flex items-center justify-between text-xs">
            <div className="text-dark-400">
              Visual span on calendar:{' '}
              <strong className="text-theme-title font-mono">
                {startTime} – {endTime}
              </strong>
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-theme-accent/15 border border-theme-accent/30 text-theme-accent font-mono font-bold text-[11px]">
              {duration >= 60 ? `${(duration / 60).toFixed(1).replace('.0', '')} hrs (${duration}m)` : `${duration} mins`}
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-dark-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-xs font-semibold text-dark-400 hover:text-theme-title transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-theme-accent hover:bg-theme-accent-hover text-white text-xs font-bold shadow-glow-accent transition-all flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{initialSlot?.planItem ? 'Save Changes' : 'Schedule Slot'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
