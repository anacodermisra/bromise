import React, { useState } from 'react';
import type { MuscleGroup } from '../../types';
import { MUSCLE_REGISTRY } from '../../utils/gymData';
import { Sparkles } from 'lucide-react';

interface BodyMapProps {
  highlightedMuscles: MuscleGroup[];
  selectedMuscle?: MuscleGroup | null;
  onSelectMuscle?: (muscle: MuscleGroup | null) => void;
  className?: string;
}

export const BodyMap: React.FC<BodyMapProps> = ({
  highlightedMuscles = [],
  selectedMuscle = null,
  onSelectMuscle,
  className = '',
}) => {
  const [view, setView] = useState<'front' | 'back' | 'both'>('front');
  const [hoveredMuscle, setHoveredMuscle] = useState<MuscleGroup | null>(null);

  const isMuscleActive = (muscle: MuscleGroup) => {
    return (
      highlightedMuscles.includes(muscle) ||
      selectedMuscle === muscle ||
      hoveredMuscle === muscle
    );
  };

  const getMuscleFill = (muscle: MuscleGroup) => {
    if (selectedMuscle === muscle) {
      return '#00f0ff'; // Vibrant Electric Cyan
    }
    if (highlightedMuscles.includes(muscle) || hoveredMuscle === muscle) {
      return '#38bdf8'; // Neon Sky Blue
    }
    return '#1e2638'; // Dark Slate Base
  };

  const getMuscleStroke = (muscle: MuscleGroup) => {
    if (selectedMuscle === muscle) {
      return '#e0f2fe';
    }
    if (highlightedMuscles.includes(muscle) || hoveredMuscle === muscle) {
      return '#7dd3fc';
    }
    return '#334155';
  };

  const getMuscleFilter = (muscle: MuscleGroup) => {
    if (isMuscleActive(muscle)) {
      return 'url(#neonGlow)';
    }
    return undefined;
  };

  const handleMuscleClick = (muscle: MuscleGroup) => {
    if (onSelectMuscle) {
      onSelectMuscle(selectedMuscle === muscle ? null : muscle);
    }
  };

  const renderFrontBody = () => (
    <svg
      viewBox="0 0 300 480"
      className="w-full h-full max-h-[460px] drop-shadow-2xl select-none"
    >
      <defs>
        <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="bodyBaseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#020617" />
        </linearGradient>
      </defs>

      {/* Silhouette outline background for anatomical context */}
      <g opacity="0.35" stroke="#1e293b" strokeWidth="1" fill="url(#bodyBaseGradient)">
        {/* Head */}
        <circle cx="150" cy="40" r="24" />
        {/* Neck */}
        <path d="M 140 60 L 140 80 L 160 80 L 160 60 Z" />
      </g>

      {/* Head & Neck */}
      <circle cx="150" cy="42" r="22" fill="#1e2638" stroke="#334155" strokeWidth="1.5" />
      <rect x="142" y="60" width="16" height="18" rx="4" fill="#1e2638" stroke="#334155" strokeWidth="1.5" />

      {/* Traps (Front) */}
      <path
        d="M 132 78 L 142 66 L 158 66 L 168 78 L 158 84 L 142 84 Z"
        fill={getMuscleFill('traps')}
        stroke={getMuscleStroke('traps')}
        strokeWidth="1.5"
        filter={getMuscleFilter('traps')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('traps')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('traps')}
      />

      {/* Shoulders - Front Deltoids (Left & Right) */}
      <path
        d="M 104 88 C 96 95, 94 112, 102 120 C 110 115, 115 102, 114 90 Z"
        fill={getMuscleFill('front_delts')}
        stroke={getMuscleStroke('front_delts')}
        strokeWidth="1.5"
        filter={getMuscleFilter('front_delts')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('front_delts')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('front_delts')}
      />
      <path
        d="M 196 88 C 204 95, 206 112, 198 120 C 190 115, 185 102, 186 90 Z"
        fill={getMuscleFill('front_delts')}
        stroke={getMuscleStroke('front_delts')}
        strokeWidth="1.5"
        filter={getMuscleFilter('front_delts')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('front_delts')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('front_delts')}
      />

      {/* Upper Chest (Clavicular) */}
      <path
        d="M 116 88 L 148 90 L 148 106 L 115 104 Z"
        fill={getMuscleFill('upper_chest')}
        stroke={getMuscleStroke('upper_chest')}
        strokeWidth="1.5"
        filter={getMuscleFilter('upper_chest')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('upper_chest')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('upper_chest')}
      />
      <path
        d="M 184 88 L 152 90 L 152 106 L 185 104 Z"
        fill={getMuscleFill('upper_chest')}
        stroke={getMuscleStroke('upper_chest')}
        strokeWidth="1.5"
        filter={getMuscleFilter('upper_chest')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('upper_chest')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('upper_chest')}
      />

      {/* Main Chest (Pectorals - Left & Right) */}
      <path
        d="M 115 105 L 148 107 L 148 134 C 132 138, 114 130, 114 116 Z"
        fill={getMuscleFill('chest')}
        stroke={getMuscleStroke('chest')}
        strokeWidth="1.5"
        filter={getMuscleFilter('chest')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('chest')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('chest')}
      />
      <path
        d="M 185 105 L 152 107 L 152 134 C 168 138, 186 130, 186 116 Z"
        fill={getMuscleFill('chest')}
        stroke={getMuscleStroke('chest')}
        strokeWidth="1.5"
        filter={getMuscleFilter('chest')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('chest')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('chest')}
      />

      {/* Biceps (Left & Right) */}
      <path
        d="M 98 122 C 92 130, 92 148, 100 158 C 106 154, 110 140, 108 124 Z"
        fill={getMuscleFill('biceps')}
        stroke={getMuscleStroke('biceps')}
        strokeWidth="1.5"
        filter={getMuscleFilter('biceps')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('biceps')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('biceps')}
      />
      <path
        d="M 202 122 C 208 130, 208 148, 200 158 C 194 154, 190 140, 192 124 Z"
        fill={getMuscleFill('biceps')}
        stroke={getMuscleStroke('biceps')}
        strokeWidth="1.5"
        filter={getMuscleFilter('biceps')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('biceps')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('biceps')}
      />

      {/* Forearms (Left & Right) */}
      <path
        d="M 97 162 C 90 174, 88 196, 94 210 C 99 208, 104 192, 105 168 Z"
        fill={getMuscleFill('forearms')}
        stroke={getMuscleStroke('forearms')}
        strokeWidth="1.5"
        filter={getMuscleFilter('forearms')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('forearms')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('forearms')}
      />
      <path
        d="M 203 162 C 210 174, 212 196, 206 210 C 201 208, 196 192, 195 168 Z"
        fill={getMuscleFill('forearms')}
        stroke={getMuscleStroke('forearms')}
        strokeWidth="1.5"
        filter={getMuscleFilter('forearms')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('forearms')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('forearms')}
      />

      {/* Core / Abs (Six-Pack segments) */}
      {/* Upper Abs */}
      <rect
        x="135"
        y="140"
        width="13"
        height="14"
        rx="2"
        fill={getMuscleFill('abs')}
        stroke={getMuscleStroke('abs')}
        strokeWidth="1.2"
        filter={getMuscleFilter('abs')}
        className="cursor-pointer hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('abs')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('abs')}
      />
      <rect
        x="152"
        y="140"
        width="13"
        height="14"
        rx="2"
        fill={getMuscleFill('abs')}
        stroke={getMuscleStroke('abs')}
        strokeWidth="1.2"
        filter={getMuscleFilter('abs')}
        className="cursor-pointer hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('abs')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('abs')}
      />
      {/* Mid Abs */}
      <rect
        x="135"
        y="157"
        width="13"
        height="14"
        rx="2"
        fill={getMuscleFill('abs')}
        stroke={getMuscleStroke('abs')}
        strokeWidth="1.2"
        filter={getMuscleFilter('abs')}
        className="cursor-pointer hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('abs')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('abs')}
      />
      <rect
        x="152"
        y="157"
        width="13"
        height="14"
        rx="2"
        fill={getMuscleFill('abs')}
        stroke={getMuscleStroke('abs')}
        strokeWidth="1.2"
        filter={getMuscleFilter('abs')}
        className="cursor-pointer hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('abs')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('abs')}
      />
      {/* Lower Abs */}
      <rect
        x="136"
        y="174"
        width="12"
        height="15"
        rx="2"
        fill={getMuscleFill('abs')}
        stroke={getMuscleStroke('abs')}
        strokeWidth="1.2"
        filter={getMuscleFilter('abs')}
        className="cursor-pointer hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('abs')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('abs')}
      />
      <rect
        x="152"
        y="174"
        width="12"
        height="15"
        rx="2"
        fill={getMuscleFill('abs')}
        stroke={getMuscleStroke('abs')}
        strokeWidth="1.2"
        filter={getMuscleFilter('abs')}
        className="cursor-pointer hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('abs')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('abs')}
      />

      {/* Obliques (Left & Right) */}
      <path
        d="M 120 142 C 122 165, 126 185, 132 192 L 132 144 Z"
        fill={getMuscleFill('obliques')}
        stroke={getMuscleStroke('obliques')}
        strokeWidth="1.2"
        filter={getMuscleFilter('obliques')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('obliques')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('obliques')}
      />
      <path
        d="M 180 142 C 178 165, 174 185, 168 192 L 168 144 Z"
        fill={getMuscleFill('obliques')}
        stroke={getMuscleStroke('obliques')}
        strokeWidth="1.2"
        filter={getMuscleFilter('obliques')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('obliques')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('obliques')}
      />

      {/* Pelvis / Hips Base */}
      <path
        d="M 130 194 L 170 194 L 176 216 L 150 224 L 124 216 Z"
        fill="#182030"
        stroke="#273549"
        strokeWidth="1"
      />

      {/* Quadriceps (Front Thighs - Left & Right) */}
      <path
        d="M 124 220 C 114 240, 112 285, 126 312 C 138 312, 146 270, 148 226 Z"
        fill={getMuscleFill('quads')}
        stroke={getMuscleStroke('quads')}
        strokeWidth="1.5"
        filter={getMuscleFilter('quads')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('quads')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('quads')}
      />
      <path
        d="M 176 220 C 186 240, 188 285, 174 312 C 162 312, 154 270, 152 226 Z"
        fill={getMuscleFill('quads')}
        stroke={getMuscleStroke('quads')}
        strokeWidth="1.5"
        filter={getMuscleFilter('quads')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('quads')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('quads')}
      />

      {/* Knees */}
      <circle cx="132" cy="324" r="9" fill="#182030" stroke="#334155" strokeWidth="1" />
      <circle cx="168" cy="324" r="9" fill="#182030" stroke="#334155" strokeWidth="1" />

      {/* Calves (Front Tibialis / Lower Leg) */}
      <path
        d="M 126 336 C 118 350, 118 385, 126 420 C 134 420, 138 390, 138 336 Z"
        fill={getMuscleFill('calves')}
        stroke={getMuscleStroke('calves')}
        strokeWidth="1.5"
        filter={getMuscleFilter('calves')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('calves')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('calves')}
      />
      <path
        d="M 174 336 C 182 350, 182 385, 174 420 C 166 420, 162 390, 162 336 Z"
        fill={getMuscleFill('calves')}
        stroke={getMuscleStroke('calves')}
        strokeWidth="1.5"
        filter={getMuscleFilter('calves')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('calves')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('calves')}
      />

      {/* Feet */}
      <path d="M 120 424 L 132 424 L 134 442 L 114 442 Z" fill="#1e2638" stroke="#334155" strokeWidth="1" />
      <path d="M 180 424 L 168 424 L 166 442 L 186 442 Z" fill="#1e2638" stroke="#334155" strokeWidth="1" />
    </svg>
  );

  const renderBackBody = () => (
    <svg
      viewBox="0 0 300 480"
      className="w-full h-full max-h-[460px] drop-shadow-2xl select-none"
    >
      <defs>
        <filter id="neonGlowBack" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Head & Neck (Back) */}
      <circle cx="150" cy="42" r="22" fill="#1e2638" stroke="#334155" strokeWidth="1.5" />
      <rect x="142" y="60" width="16" height="18" rx="4" fill="#1e2638" stroke="#334155" strokeWidth="1.5" />

      {/* Trapezius / Upper Back (Diamond shape) */}
      <path
        d="M 150 70 L 178 86 L 160 134 L 150 142 L 140 134 L 122 86 Z"
        fill={getMuscleFill('traps')}
        stroke={getMuscleStroke('traps')}
        strokeWidth="1.5"
        filter={getMuscleFilter('traps')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('traps')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('traps')}
      />

      {/* Rear Deltoids (Left & Right) */}
      <path
        d="M 104 88 C 96 95, 96 112, 106 122 C 114 116, 118 102, 116 88 Z"
        fill={getMuscleFill('rear_delts')}
        stroke={getMuscleStroke('rear_delts')}
        strokeWidth="1.5"
        filter={getMuscleFilter('rear_delts')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('rear_delts')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('rear_delts')}
      />
      <path
        d="M 196 88 C 204 95, 204 112, 194 122 C 186 116, 182 102, 184 88 Z"
        fill={getMuscleFill('rear_delts')}
        stroke={getMuscleStroke('rear_delts')}
        strokeWidth="1.5"
        filter={getMuscleFilter('rear_delts')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('rear_delts')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('rear_delts')}
      />

      {/* Triceps (Left & Right) */}
      <path
        d="M 98 122 C 92 130, 92 148, 100 158 C 106 154, 110 140, 108 124 Z"
        fill={getMuscleFill('triceps')}
        stroke={getMuscleStroke('triceps')}
        strokeWidth="1.5"
        filter={getMuscleFilter('triceps')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('triceps')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('triceps')}
      />
      <path
        d="M 202 122 C 208 130, 208 148, 200 158 C 194 154, 190 140, 192 124 Z"
        fill={getMuscleFill('triceps')}
        stroke={getMuscleStroke('triceps')}
        strokeWidth="1.5"
        filter={getMuscleFilter('triceps')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('triceps')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('triceps')}
      />

      {/* Forearms (Back) */}
      <path
        d="M 97 162 C 90 174, 88 196, 94 210 C 99 208, 104 192, 105 168 Z"
        fill={getMuscleFill('forearms')}
        stroke={getMuscleStroke('forearms')}
        strokeWidth="1.5"
        filter={getMuscleFilter('forearms')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('forearms')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('forearms')}
      />
      <path
        d="M 203 162 C 210 174, 212 196, 206 210 C 201 208, 196 192, 195 168 Z"
        fill={getMuscleFill('forearms')}
        stroke={getMuscleStroke('forearms')}
        strokeWidth="1.5"
        filter={getMuscleFilter('forearms')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('forearms')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('forearms')}
      />

      {/* Lats (Latissimus Dorsi - Left & Right V-Taper Wings) */}
      <path
        d="M 118 100 C 112 124, 114 154, 134 168 L 140 144 Z"
        fill={getMuscleFill('lats')}
        stroke={getMuscleStroke('lats')}
        strokeWidth="1.5"
        filter={getMuscleFilter('lats')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('lats')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('lats')}
      />
      <path
        d="M 182 100 C 188 124, 186 154, 166 168 L 160 144 Z"
        fill={getMuscleFill('lats')}
        stroke={getMuscleStroke('lats')}
        strokeWidth="1.5"
        filter={getMuscleFilter('lats')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('lats')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('lats')}
      />

      {/* Lower Back (Erectors) */}
      <path
        d="M 136 164 L 148 164 L 148 194 L 134 194 Z"
        fill={getMuscleFill('lower_back')}
        stroke={getMuscleStroke('lower_back')}
        strokeWidth="1.2"
        filter={getMuscleFilter('lower_back')}
        className="cursor-pointer hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('lower_back')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('lower_back')}
      />
      <path
        d="M 152 164 L 164 164 L 166 194 L 152 194 Z"
        fill={getMuscleFill('lower_back')}
        stroke={getMuscleStroke('lower_back')}
        strokeWidth="1.2"
        filter={getMuscleFilter('lower_back')}
        className="cursor-pointer hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('lower_back')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('lower_back')}
      />

      {/* Glutes (Left & Right) */}
      <path
        d="M 124 198 C 114 208, 114 235, 128 244 C 142 246, 148 230, 148 200 Z"
        fill={getMuscleFill('glutes')}
        stroke={getMuscleStroke('glutes')}
        strokeWidth="1.5"
        filter={getMuscleFilter('glutes')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('glutes')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('glutes')}
      />
      <path
        d="M 176 198 C 186 208, 186 235, 172 244 C 158 246, 152 230, 152 200 Z"
        fill={getMuscleFill('glutes')}
        stroke={getMuscleStroke('glutes')}
        strokeWidth="1.5"
        filter={getMuscleFilter('glutes')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('glutes')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('glutes')}
      />

      {/* Hamstrings (Left & Right) */}
      <path
        d="M 126 248 C 116 265, 116 295, 128 316 C 140 316, 146 290, 146 248 Z"
        fill={getMuscleFill('hamstrings')}
        stroke={getMuscleStroke('hamstrings')}
        strokeWidth="1.5"
        filter={getMuscleFilter('hamstrings')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('hamstrings')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('hamstrings')}
      />
      <path
        d="M 174 248 C 184 265, 184 295, 172 316 C 160 316, 154 290, 154 248 Z"
        fill={getMuscleFill('hamstrings')}
        stroke={getMuscleStroke('hamstrings')}
        strokeWidth="1.5"
        filter={getMuscleFilter('hamstrings')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('hamstrings')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('hamstrings')}
      />

      {/* Knees Back */}
      <circle cx="132" cy="324" r="8" fill="#182030" stroke="#334155" strokeWidth="1" />
      <circle cx="168" cy="324" r="8" fill="#182030" stroke="#334155" strokeWidth="1" />

      {/* Calves (Gastrocnemius Diamond Bells - Back) */}
      <path
        d="M 126 336 C 114 350, 114 380, 126 420 C 138 420, 142 385, 138 336 Z"
        fill={getMuscleFill('calves')}
        stroke={getMuscleStroke('calves')}
        strokeWidth="1.5"
        filter={getMuscleFilter('calves')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('calves')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('calves')}
      />
      <path
        d="M 174 336 C 186 350, 186 380, 174 420 C 162 420, 158 385, 162 336 Z"
        fill={getMuscleFill('calves')}
        stroke={getMuscleStroke('calves')}
        strokeWidth="1.5"
        filter={getMuscleFilter('calves')}
        className="cursor-pointer transition-all duration-300 hover:brightness-125"
        onMouseEnter={() => setHoveredMuscle('calves')}
        onMouseLeave={() => setHoveredMuscle(null)}
        onClick={() => handleMuscleClick('calves')}
      />

      {/* Feet */}
      <path d="M 120 424 L 132 424 L 134 442 L 114 442 Z" fill="#1e2638" stroke="#334155" strokeWidth="1" />
      <path d="M 180 424 L 168 424 L 166 442 L 186 442 Z" fill="#1e2638" stroke="#334155" strokeWidth="1" />
    </svg>
  );

  const activeInfo = hoveredMuscle
    ? MUSCLE_REGISTRY[hoveredMuscle]
    : selectedMuscle
    ? MUSCLE_REGISTRY[selectedMuscle]
    : null;

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Front / Back Toggle Buttons - Matte White Shiny Chrome */}
      <div className="flex items-center space-x-1.5 p-1 rounded-xl bg-slate-950/70 border border-white/20 backdrop-blur-md mb-3 shadow-inner">
        <button
          type="button"
          onClick={() => setView('front')}
          className={`px-3 py-1 text-xs rounded-lg transition-all ${
            view === 'front'
              ? 'bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 font-black border border-white/90 shadow-[0_2px_10px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]'
              : 'text-slate-300 hover:text-white hover:bg-white/10 font-bold'
          }`}
        >
          Front Body
        </button>
        <button
          type="button"
          onClick={() => setView('back')}
          className={`px-3 py-1 text-xs rounded-lg transition-all ${
            view === 'back'
              ? 'bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 font-black border border-white/90 shadow-[0_2px_10px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]'
              : 'text-slate-300 hover:text-white hover:bg-white/10 font-bold'
          }`}
        >
          Back Body
        </button>
        <button
          type="button"
          onClick={() => setView('both')}
          className={`hidden sm:block px-3 py-1 text-xs rounded-lg transition-all ${
            view === 'both'
              ? 'bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-950 font-black border border-white/90 shadow-[0_2px_10px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]'
              : 'text-slate-300 hover:text-white hover:bg-white/10 font-bold'
          }`}
        >
          Dual View
        </button>
      </div>

      {/* Body Diagram Visual */}
      <div className="w-full flex justify-center items-center gap-4">
        {view === 'both' ? (
          <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Front</span>
              {renderFrontBody()}
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-dark-400 uppercase tracking-widest mb-1">Back</span>
              {renderBackBody()}
            </div>
          </div>
        ) : view === 'front' ? (
          <div className="w-full max-w-[220px]">{renderFrontBody()}</div>
        ) : (
          <div className="w-full max-w-[220px]">{renderBackBody()}</div>
        )}
      </div>

      {/* Dynamic Muscle Target Info Banner */}
      <div className="mt-3 w-full max-w-xs text-center min-h-[46px] p-2.5 rounded-xl bg-gradient-to-b from-white/10 to-white/5 border border-white/20 backdrop-blur-md flex flex-col justify-center shadow-lg">
        {activeInfo ? (
          <div>
            <div className="flex items-center justify-center space-x-1.5 text-xs font-black text-white">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
              <span>{activeInfo.name}</span>
            </div>
            <p className="text-[10px] text-slate-300 font-medium mt-0.5">{activeInfo.description}</p>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 font-medium italic">
            Hover or tap any exercise to highlight its target muscle group in neon blue
          </p>
        )}
      </div>
    </div>
  );
};
