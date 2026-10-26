import React, { useEffect } from 'react';
import {
  X,
  Snowflake,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { applyTheme, getStoredTheme } from '../../utils/theme';

interface UpdateAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateAnnouncementModal: React.FC<UpdateAnnouncementModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Listen for Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentTheme = getStoredTheme();

  const handleActivateWinterArc = () => {
    if (currentTheme !== 'winter-arc') {
      applyTheme('winter-arc');
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-dark-950 border border-cyan-500/30 rounded-3xl w-full max-w-lg shadow-[0_0_50px_-10px_rgba(56,189,248,0.3)] overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* TOP HERO IMAGE BANNER */}
        <div className="relative h-48 sm:h-52 w-full overflow-hidden flex-shrink-0 bg-dark-900 select-none">
          <img
            src="/winter-arc-bg.jpg"
            alt="Winter Arc Samurai"
            className="w-full h-full object-cover object-top filter brightness-105 contrast-105"
          />
          {/* Subtle gradient vignette to blend cleanly into the dark modal body */}
          <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-dark-950/50 via-transparent to-dark-950/50" />

          {/* Close X Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-xl bg-dark-950/70 hover:bg-dark-950 text-slate-300 hover:text-white border border-white/10 backdrop-blur-md transition-all shadow-lg"
            title="Close update dialog"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Overlay Title & Badges */}
          <div className="absolute bottom-3 left-4 right-4 space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider backdrop-blur-md">
              <Snowflake className="w-3 h-3 text-cyan-300 animate-pulse" />
              <span>Winter Arc • v1.2</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide font-sans drop-shadow-md">
              BROMISE 1.2 UPDATE
            </h2>
            <p className="text-xs text-cyan-200/90 font-medium drop-shadow">
              Ruthless discipline, precision timetable & atmospheric power.
            </p>
          </div>
        </div>

        {/* SCROLLABLE CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs sm:text-sm text-slate-200 scrollbar-thin scrollbar-thumb-dark-700">
          <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-cyan-100 text-xs leading-relaxed">
            <p>
              Welcome to the <strong>Winter Arc</strong>. Designed for daily execution and locked-in focus, version 1.2 introduces calendar-accurate timetable scheduling, multi-slot repeat sessions, and atmospheric visual effects.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>What's New in This Release</span>
            </h3>

            {/* Feature 1: Google Calendar Style Timetable */}
            <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-dark-800 space-y-1.5 hover:border-cyan-500/30 transition-all">
              <div className="flex items-center space-x-2 text-cyan-300 font-bold text-xs">
                <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Google Calendar Proportional Timetable</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Visual hourly breakdown with blocks scaled proportionally to task length (15m, 30m, 1h, 2h+). Drag tasks directly into any hour, use quick <strong>+15m / -15m</strong> buttons, or switch zoom presets (Full 24h, Morning, Afternoon, Evening).
              </p>
            </div>

            {/* Feature 2: Multi-Slot Repeat Tasks */}
            <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-dark-800 space-y-1.5 hover:border-cyan-500/30 transition-all">
              <div className="flex items-center space-x-2 text-purple-300 font-bold text-xs">
                <Layers className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span>Multi-Slot Daily Scheduling</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Schedule multiple slots throughout the day for the same activity (e.g. Morning & Evening Deep Work). Multi-slot tasks appear once in your Today list with clean slot count badges.
              </p>
            </div>

            {/* Feature 3: Winter Arc Theme & Dynamic Snow */}
            <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-dark-800 space-y-1.5 hover:border-cyan-500/30 transition-all">
              <div className="flex items-center space-x-2 text-blue-300 font-bold text-xs">
                <Snowflake className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>Winter Arc Theme & Atmospheric Snow</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Obsidian and icy frost aesthetic with the samurai mountain backdrop. Dynamic falling snow particles drift randomly across the screen, with independent toggles in Settings.
              </p>
            </div>

            {/* Feature 4: Usability & Performance Fixes */}
            <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-dark-800 space-y-1.5 hover:border-cyan-500/30 transition-all">
              <div className="flex items-center space-x-2 text-emerald-300 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Enhanced Contrast & Crash Resilience</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                Solid high-contrast cards (`rgba(15, 23, 42, 0.95)`), zero-occlusion z-index layering, seamless single-page scrolling with no header overlap, and integrated React Error Boundaries.
              </p>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BUTTONS */}
        <div className="p-4 sm:p-5 border-t border-dark-800 bg-dark-950 flex flex-col sm:flex-row items-center gap-2.5">
          {currentTheme !== 'winter-arc' ? (
            <button
              onClick={handleActivateWinterArc}
              className="w-full flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(56,189,248,0.4)] transition-all"
            >
              <Snowflake className="w-4 h-4" />
              <span>Enable Winter Arc & Enter</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="w-full flex-1 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(56,189,248,0.4)] transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Enter Command Center</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-dark-300 hover:text-white border border-dark-750 text-xs font-semibold transition-all"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
