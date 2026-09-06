import React from 'react';
import * as Icons from 'lucide-react';

interface IconHelperProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export const IconHelper: React.FC<IconHelperProps> = ({ name, className = 'w-5 h-5', style }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LucideIcon = (Icons as any)[name] || Icons.Folder;
  return <LucideIcon className={className} style={style} />;
};

export const AVAILABLE_ICONS = [
  'Sparkles',
  'GraduationCap',
  'Briefcase',
  'Camera',
  'Share2',
  'BookOpen',
  'Code',
  'Dumbbell',
  'HeartPulse',
  'Laptop',
  'Target',
  'Zap',
  'Flame',
  'Star',
  'Coffee',
  'Music',
  'Palette',
  'Smile',
];
