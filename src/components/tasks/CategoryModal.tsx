import React, { useState, useEffect } from 'react';
import type { Category } from '../../types';
import { AVAILABLE_ICONS, IconHelper } from '../common/IconHelper';
import { X } from 'lucide-react';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Omit<Category, 'id' | 'createdAt' | 'position'> | Partial<Category>, id?: string) => void;
  initialCategory?: Category | null;
}

const PRESET_COLORS = [
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#06b6d4',
  '#ec4899',
  '#a855f7',
];

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialCategory,
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Sparkles');
  const [accent, setAccent] = useState('#8b5cf6');

  useEffect(() => {
    if (initialCategory) {
      setName(initialCategory.name);
      setIcon(initialCategory.icon);
      setAccent(initialCategory.accent);
    } else {
      setName('');
      setIcon('Sparkles');
      setAccent('#8b5cf6');
    }
  }, [initialCategory, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (initialCategory) {
      onSave({ name: name.trim(), icon, accent }, initialCategory.id);
    } else {
      onSave({ name: name.trim(), icon, accent });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 border border-dark-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-dark-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center border"
              style={{ backgroundColor: `${accent}20`, borderColor: `${accent}40` }}
            >
              <IconHelper name={icon} className="w-5 h-5" style={{ color: accent }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-theme-title font-sans">
                {initialCategory ? 'Edit Category' : 'New Category'}
              </h3>
              <p className="text-xs text-dark-500">Customize icon and accent color.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-dark-500 hover:text-theme-title hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">Category Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Design Systems"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-dark-950 border border-dark-800 rounded-xl px-4 py-2.5 text-sm text-theme-title placeholder-dark-600 focus:outline-none focus:border-theme-accent transition-colors"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">Accent Color</label>
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              {PRESET_COLORS.map(color => (
                <button
                  type="button"
                  key={color}
                  onClick={() => setAccent(color)}
                  className={`w-8 h-8 rounded-xl transition-all transform hover:scale-105 ${
                    accent === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-900 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">Category Icon</label>
            <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1 bg-dark-950 rounded-xl border border-dark-800">
              {AVAILABLE_ICONS.map(ic => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setIcon(ic)}
                  className={`p-2.5 rounded-lg flex items-center justify-center transition-all ${
                    icon === ic ? 'bg-dark-800 border border-theme-accent text-theme-title' : 'text-dark-500 hover:text-theme-title'
                  }`}
                >
                  <IconHelper name={ic} className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-xs font-semibold text-dark-400 hover:text-theme-title transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-theme-accent to-theme-accent-secondary hover:from-theme-accent/90 hover:to-theme-accent-secondary/90 text-white text-xs font-bold shadow-glow-accent transition-all"
            >
              {initialCategory ? 'Save Category' : 'Create Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
