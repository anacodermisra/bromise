import React, { useState, useEffect } from 'react';
import type { GymSchedule, GymExercise, MuscleGroup } from '../../types';
import { BodyMap } from './BodyMap';
import {
  getTodayDayKey,
  DAY_KEYS,
  MUSCLE_REGISTRY,
  DEFAULT_GYM_SCHEDULE,
} from '../../utils/gymData';
import { getGymSchedule, saveGymSchedule } from '../../utils/storage';
import confetti from 'canvas-confetti';
import {
  Dumbbell,
  CheckCircle2,
  Circle,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  ArrowRight,
} from 'lucide-react';

interface GymRoomViewProps {
  onPushToToday?: (taskTitle: string, notes?: string) => void;
}

export const GymRoomView: React.FC<GymRoomViewProps> = ({ onPushToToday }) => {
  const [schedule, setSchedule] = useState<GymSchedule>(getGymSchedule());
  const todayKey = getTodayDayKey();
  const [selectedDay, setSelectedDay] = useState<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>(todayKey);
  const [hoveredExercise, setHoveredExercise] = useState<GymExercise | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

  // Rest Timer State
  const [restSeconds, setRestSeconds] = useState(90);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Add Exercise Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExMuscles, setNewExMuscles] = useState<MuscleGroup[]>([]);
  const [newExSets, setNewExSets] = useState(3);
  const [newExReps, setNewExReps] = useState('10-12 reps');
  const [newExWeight, setNewExWeight] = useState(40);
  const [newExNotes, setNewExNotes] = useState('');

  const currentSplit = schedule[selectedDay] || schedule['mon'];

  useEffect(() => {
    const handleGymChange = () => setSchedule(getGymSchedule());
    window.addEventListener('bromise-gym-change', handleGymChange);
    return () => window.removeEventListener('bromise-gym-change', handleGymChange);
  }, []);

  // Timer countdown interval
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerRemaining !== null && timerRemaining > 0) {
      interval = setInterval(() => {
        setTimerRemaining(prev => {
          if (prev === null || prev <= 1) {
            setIsTimerRunning(false);
            // Play alert sound via Web Audio API
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch A5
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.5);
            } catch {}
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerRemaining]);

  const handleStartTimer = (seconds: number) => {
    setRestSeconds(seconds);
    setTimerRemaining(seconds);
    setIsTimerRunning(true);
  };

  const handleToggleTimer = () => {
    if (timerRemaining === null || timerRemaining === 0) {
      setTimerRemaining(restSeconds);
      setIsTimerRunning(true);
    } else {
      setIsTimerRunning(!isTimerRunning);
    }
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setTimerRemaining(restSeconds);
  };

  // Toggle Exercise Complete
  const handleToggleComplete = (exerciseId: string) => {
    const updatedExercises = currentSplit.exercises.map(ex => {
      if (ex.id === exerciseId) {
        const nextCompleted = !ex.completed;
        if (nextCompleted) {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#00f0ff', '#38bdf8', '#8b5cf6', '#10b981'],
          });
          // Auto-start rest timer
          handleStartTimer(restSeconds);
        }
        return { ...ex, completed: nextCompleted };
      }
      return ex;
    });

    const nextSchedule = {
      ...schedule,
      [selectedDay]: {
        ...currentSplit,
        exercises: updatedExercises,
      },
    };
    setSchedule(nextSchedule);
    saveGymSchedule(nextSchedule);
  };

  // Save New Exercise
  const handleAddExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName.trim()) return;

    const newEx: GymExercise = {
      id: `ex-${Date.now()}`,
      name: newExName.trim(),
      targetMuscles: newExMuscles.length > 0 ? newExMuscles : ['chest'],
      defaultSets: Number(newExSets) || 3,
      defaultReps: newExReps || '10-12 reps',
      defaultWeightKg: Number(newExWeight) || 0,
      notes: newExNotes.trim() || undefined,
      completed: false,
    };

    const nextSchedule = {
      ...schedule,
      [selectedDay]: {
        ...currentSplit,
        exercises: [...currentSplit.exercises, newEx],
      },
    };
    setSchedule(nextSchedule);
    saveGymSchedule(nextSchedule);

    setNewExName('');
    setNewExMuscles([]);
    setNewExNotes('');
    setIsAddModalOpen(false);
  };

  const handleDeleteExercise = (exId: string) => {
    if (!window.confirm('Remove this exercise from your routine?')) return;
    const nextSchedule = {
      ...schedule,
      [selectedDay]: {
        ...currentSplit,
        exercises: currentSplit.exercises.filter(ex => ex.id !== exId),
      },
    };
    setSchedule(nextSchedule);
    saveGymSchedule(nextSchedule);
  };

  // Reset to Recommended Protocol
  const handleResetToDefaultSchedule = () => {
    if (window.confirm('Reset workout schedule to the recommended 7-day routine? Any custom exercises will be reset.')) {
      setSchedule(DEFAULT_GYM_SCHEDULE);
      saveGymSchedule(DEFAULT_GYM_SCHEDULE);
    }
  };

  // Push Workout to Bromise Today
  const handleSyncToToday = () => {
    if (onPushToToday) {
      const title = `[Gym] ${currentSplit.title}`;
      const exerciseList = currentSplit.exercises
        .map(ex => `• ${ex.name} (${ex.defaultSets}×${ex.defaultReps} @ ${ex.defaultWeightKg}kg)`)
        .join('\n');
      onPushToToday(title, exerciseList);
      alert(`Workout "${currentSplit.title}" has been pushed to your Today Plan!`);
    }
  };

  const completedCount = currentSplit.exercises.filter(ex => ex.completed).length;
  const totalCount = currentSplit.exercises.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Compute highlighted muscles:
  // Either from currently hovered exercise, or if selectedDay is active and an exercise is highlighted,
  // or fall back to the day's focusMuscles!
  const highlightedMuscles: MuscleGroup[] = hoveredExercise
    ? hoveredExercise.targetMuscles
    : selectedMuscle
    ? [selectedMuscle]
    : currentSplit.focusMuscles || [];

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Banner - Matte White Chrome Luxe Finish */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-950/80 border border-white/25 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] relative overflow-hidden">
        {/* Sleek Cyan Underglow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1 relative z-10">
          <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-300 uppercase tracking-widest">
            <Dumbbell className="w-4 h-4 animate-pulse" />
            <span>The Iron Den · Daily Workout Protocol</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white font-sans flex items-center space-x-3 tracking-tight">
            <span>GYM ROOM</span>
            <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 border border-white shadow-[0_2px_8px_rgba(255,255,255,0.35)]">
              High Intensity
            </span>
          </h2>
          <p className="text-xs text-slate-300 font-medium">
            Interactive anatomical muscle targeting, weekly training splits, and live workout logging.
          </p>
        </div>

        {/* Action Controls - Matte White Shiny Chrome */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10">
          <div className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white/10 border border-white/30 text-white text-xs font-bold shadow-sm backdrop-blur-md">
            <Dumbbell className="w-3.5 h-3.5 text-cyan-300" />
            <span>The Iron Den Atmosphere</span>
          </div>

          <button
            type="button"
            onClick={handleResetToDefaultSchedule}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-bold shadow-sm backdrop-blur-md transition-colors"
            title="Reset to recommended 7-day routine"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-300" />
            <span>Reset Routine</span>
          </button>

          {onPushToToday && (
            <button
              type="button"
              onClick={handleSyncToToday}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-b from-white via-slate-100 to-slate-200 hover:from-white hover:to-white text-slate-950 text-xs font-black border border-white/90 shadow-[0_4px_16px_rgba(255,255,255,0.35),inset_0_1px_2px_rgba(255,255,255,1)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Push to Today Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Day Selector Pills (Mon - Sun) - Matte White Shiny Polish */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
        {DAY_KEYS.map(key => {
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          const dayData = schedule[key];
          const isRest = dayData?.restDay;

          return (
            <button
              key={key}
              onClick={() => {
                setSelectedDay(key);
                setSelectedMuscle(null);
              }}
              className={`flex-shrink-0 px-4 py-3 rounded-2xl border text-left transition-all duration-200 ${
                isSelected
                  ? 'bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 border-2 border-white shadow-[0_0_20px_rgba(255,255,255,0.45),inset_0_1px_2px_rgba(255,255,255,1)] font-black'
                  : 'bg-slate-950/70 border-white/20 text-slate-300 hover:text-white hover:bg-white/10 backdrop-blur-md'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className={`text-xs uppercase tracking-wider ${isSelected ? 'font-black text-slate-950' : 'font-bold'}`}>
                  {key}
                </span>
                {isToday && (
                  <span
                    className={`w-2 h-2 rounded-full animate-pulse ${isSelected ? 'bg-cyan-600' : 'bg-cyan-400'}`}
                    title="Today's Workout"
                  />
                )}
              </div>
              <div className={`text-[11px] font-semibold truncate max-w-[120px] mt-0.5 ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                {isRest ? 'Rest Day' : dayData?.title.split('(')[0] || 'Training'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Sticky Body Map on Left, Routine on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Anatomical Body Map (Pinned / Sticky in View) */}
        <div className="lg:col-span-5 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto p-6 rounded-3xl bg-slate-950/80 border border-white/25 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-4">
          <div className="flex items-center justify-between border-b border-white/15 pb-3">
            <div>
              <h3 className="text-sm font-black text-white font-sans flex items-center space-x-2">
                <span>Anatomical Target Map</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Targeted muscles light up in neon blue on hover/click
              </p>
            </div>
            {selectedMuscle && (
              <button
                onClick={() => setSelectedMuscle(null)}
                className="text-[10px] px-2 py-0.5 rounded bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 font-bold border border-white shadow-sm hover:scale-105 transition-transform"
              >
                Clear filter
              </button>
            )}
          </div>

          <BodyMap
            highlightedMuscles={highlightedMuscles}
            selectedMuscle={selectedMuscle}
            onSelectMuscle={setSelectedMuscle}
          />

          {/* Active Target Muscles Chips */}
          <div className="space-y-1.5 pt-2 border-t border-white/15">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {hoveredExercise ? `Targeting for: ${hoveredExercise.name}` : `Today's Split Targets:`}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {highlightedMuscles.map(m => {
                const info = MUSCLE_REGISTRY[m];
                return (
                  <span
                    key={m}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/15 text-white border border-white/30 backdrop-blur-sm flex items-center space-x-1 shadow-sm"
                  >
                    <span>{info?.name.split('(')[0] || m}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Workout Checklist & Set Tracker */}
        <div className="lg:col-span-7 space-y-4">
          {/* Split Summary & Rest Timer Card - Matte White Chrome */}
          <div className="p-5 rounded-3xl bg-slate-950/80 border border-white/25 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">
                  {currentSplit.dayName} Workout
                </span>
                <h3 className="text-lg font-black text-white">{currentSplit.title}</h3>
              </div>

              {/* Workout Progress Bar */}
              <div className="flex items-center space-x-3 bg-white/10 px-3.5 py-2 rounded-xl border border-white/25 backdrop-blur-md">
                <div className="text-right">
                  <div className="text-[10px] text-slate-300 font-bold uppercase">Completed</div>
                  <div className="text-xs font-black text-white">
                    {completedCount} / {totalCount} exercises
                  </div>
                </div>
                <div className="text-sm font-black text-cyan-300">{progressPct}%</div>
              </div>
            </div>

            {/* Built-in Rest Timer Bar - Matte White Shiny Design */}
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/20 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-cyan-300" />
                <span className="text-xs font-bold text-slate-300">Rest Timer:</span>
                <span className="text-sm font-mono font-black text-white">
                  {timerRemaining !== null ? `${timerRemaining}s` : `${restSeconds}s`}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                {[60, 90, 120].map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => handleStartTimer(sec)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      restSeconds === sec && isTimerRunning
                        ? 'bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 font-black border border-white shadow-[0_0_12px_rgba(255,255,255,0.5)]'
                        : 'bg-white/10 text-slate-300 border border-white/20 hover:text-white hover:bg-white/20'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}

                <button
                  type="button"
                  onClick={handleToggleTimer}
                  className="p-1.5 rounded-lg bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 font-black border border-white/90 hover:from-white hover:to-white shadow-sm transition-all"
                  title={isTimerRunning ? 'Pause Timer' : 'Start Timer'}
                >
                  {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleResetTimer}
                  className="p-1.5 rounded-lg bg-white/10 text-slate-300 border border-white/20 hover:text-white hover:bg-white/20 transition-colors"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Exercise Checklist Cards - Matte White Shiny Card Styling */}
          <div className="space-y-3">
            {currentSplit.exercises.length === 0 ? (
              <div className="p-8 text-center bg-slate-950/70 rounded-3xl border border-white/20 space-y-2 backdrop-blur-md">
                <Dumbbell className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-300 font-semibold">No exercises configured for this day.</p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 text-xs font-black border border-white shadow-md hover:from-white hover:to-white transition-all"
                >
                  + Add First Exercise
                </button>
              </div>
            ) : (
              currentSplit.exercises.map((ex, index) => {
                const isExpanded = expandedExerciseId === ex.id;
                const isHovered = hoveredExercise?.id === ex.id;

                return (
                  <div
                    key={ex.id}
                    onMouseEnter={() => setHoveredExercise(ex)}
                    onMouseLeave={() => setHoveredExercise(null)}
                    className={`p-4.5 rounded-2xl border transition-all duration-200 ${
                      ex.completed
                        ? 'bg-white/[0.05] border-white/15 opacity-65 backdrop-blur-md'
                        : isHovered
                        ? 'bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-white/[0.12] border-white shadow-[0_8px_32px_rgba(255,255,255,0.2),inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-2xl ring-2 ring-white/40'
                        : 'bg-gradient-to-b from-white/[0.12] via-white/[0.05] to-white/[0.08] border-white/30 hover:border-white/70 shadow-[0_8px_28px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.25)] hover:shadow-[0_8px_32px_rgba(255,255,255,0.15)] backdrop-blur-2xl'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Completion Checkbox - Pure Shiny White */}
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(ex.id)}
                        className="mt-0.5 text-white hover:scale-110 transition-transform flex-shrink-0"
                      >
                        {ex.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-white fill-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                        ) : (
                          <Circle className="w-5 h-5 text-white/50 hover:text-white" />
                        )}
                      </button>

                      {/* Exercise Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={`text-sm font-extrabold tracking-tight ${
                              ex.completed ? 'line-through text-slate-400' : 'text-white'
                            }`}
                          >
                            {index + 1}. {ex.name}
                          </h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 font-black border border-white shadow-[0_2px_8px_rgba(255,255,255,0.3)]">
                            {ex.defaultSets} sets × {ex.defaultReps}
                          </span>
                          {ex.defaultWeightKg > 0 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/20 border border-white/40 text-white font-bold shadow-sm backdrop-blur-sm">
                              {ex.defaultWeightKg} kg
                            </span>
                          )}
                        </div>

                        {/* Muscle Badges - Matte White Pill Accent */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {ex.targetMuscles.map(m => (
                            <span
                              key={m}
                              className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/15 border border-white/30 text-slate-100 shadow-sm backdrop-blur-sm"
                            >
                              {MUSCLE_REGISTRY[m]?.name.split('(')[0] || m}
                            </span>
                          ))}
                        </div>

                        {ex.notes && (
                          <p className="text-[11px] text-slate-300 italic mt-1.5">{ex.notes}</p>
                        )}
                      </div>

                      {/* Expand & Delete Controls */}
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setExpandedExerciseId(isExpanded ? null : ex.id)}
                          className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/20 transition-colors"
                          title="Set Logger"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExercise(ex.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/10 transition-colors"
                          title="Delete Exercise"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expandable Set-by-Set Logging Table - Matte White Shiny Design */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-white/15 space-y-2">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                          Set-by-Set Weight Tracker
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Array.from({ length: ex.defaultSets }).map((_, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-xl bg-slate-950/80 border border-white/30 flex items-center justify-between text-xs shadow-inner"
                            >
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 border border-white shadow-sm">
                                Set {i + 1}
                              </span>
                              <span className="font-mono font-black text-white">
                                {ex.defaultWeightKg}kg × {ex.defaultReps.split('-')[0] || 10}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Add Exercise Button - Matte White Shiny Design */}
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="w-full flex items-center justify-center space-x-2 py-3.5 rounded-2xl bg-gradient-to-b from-white via-slate-100 to-slate-200 hover:from-white hover:to-white text-slate-950 font-black border border-white/90 shadow-[0_4px_18px_rgba(255,255,255,0.35),inset_0_1px_2px_rgba(255,255,255,1)] active:translate-y-0.5 text-xs transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Custom Exercise to {currentSplit.dayName}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add Custom Exercise Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-slate-950/95 border border-white/25 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Add Exercise to {currentSplit.dayName}</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddExercise} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Exercise Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Incline Dumbbell Press"
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-sm text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white/40"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Sets</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newExSets}
                    onChange={e => setNewExSets(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/20 text-sm text-white text-center font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Reps</label>
                  <input
                    type="text"
                    value={newExReps}
                    onChange={e => setNewExReps(e.target.value)}
                    placeholder="8-12 reps"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/20 text-sm text-white text-center font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    min="0"
                    value={newExWeight}
                    onChange={e => setNewExWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/20 text-sm text-white text-center font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Target Muscle(s)</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1 bg-slate-900 rounded-xl border border-white/20">
                  {Object.values(MUSCLE_REGISTRY).map(m => {
                    const isSelected = newExMuscles.includes(m.id);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => {
                          if (isSelected) {
                            setNewExMuscles(newExMuscles.filter(id => id !== m.id));
                          } else {
                            setNewExMuscles([...newExMuscles, m.id]);
                          }
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                          isSelected
                            ? 'bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 font-black border border-white shadow-sm'
                            : 'bg-white/10 text-slate-300 hover:text-white border border-white/10'
                        }`}
                      >
                        {m.name.split('(')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Form Cues / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Pause 1 sec at bottom, explosive press"
                  value={newExNotes}
                  onChange={e => setNewExNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-white/20 text-xs text-white focus:outline-none focus:border-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-b from-white via-slate-100 to-slate-200 hover:from-white hover:to-white text-slate-950 text-xs font-black border border-white/90 shadow-[0_4px_16px_rgba(255,255,255,0.35),inset_0_1px_2px_rgba(255,255,255,1)] active:translate-y-0.5 transition-all"
              >
                Save Exercise
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
