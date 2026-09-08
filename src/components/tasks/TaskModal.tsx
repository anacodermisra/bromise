import React, { useState, useEffect } from 'react';
import type { Task, Category, Priority } from '../../types';
import { X, Sparkles, CalendarClock } from 'lucide-react';
import { IconHelper } from '../common/IconHelper';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> | Partial<Task>, id?: string) => Promise<void> | void;
  categories: Category[];
  initialTask?: Task | null;
  defaultCategoryId?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories,
  initialTask,
  defaultCategoryId,
}) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [deadline, setDeadline] = useState<string>('');

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setNotes(initialTask.notes || '');
      setCategoryId(initialTask.categoryId);
      setPriority(initialTask.priority);
      setDeadline(initialTask.deadline || '');
    } else {
      setTitle('');
      setNotes('');
      setCategoryId(defaultCategoryId || (categories[0]?.id || ''));
      setPriority('medium');
      setDeadline('');
    }
  }, [initialTask, defaultCategoryId, categories, isOpen]);

  if (!isOpen) return null;

  const setQuickDeadline = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setDeadline(d.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !categoryId) return;

    if (initialTask) {
      await onSave(
        {
          title: title.trim(),
          notes: notes.trim() || undefined,
          categoryId,
          priority,
          deadline: deadline || undefined,
        },
        initialTask.id
      );
    } else {
      await onSave({
        title: title.trim(),
        notes: notes.trim() || undefined,
        categoryId,
        priority,
        deadline: deadline || undefined,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 border border-dark-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-dark-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-theme-accent/20 border border-theme-accent/30 text-theme-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-theme-title font-sans">
                {initialTask ? 'Edit Task' : 'Create New Task'}
              </h3>
              <p className="text-xs text-dark-500">Define details, priority, deadline, and category.</p>
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
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">Task Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Read module 3 case study"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-dark-950 border border-dark-800 rounded-xl px-4 py-2.5 text-sm text-theme-title placeholder-dark-600 focus:outline-none focus:border-theme-accent transition-colors"
              autoFocus
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {categories.map(cat => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    categoryId === cat.id
                      ? 'bg-dark-800 border-theme-accent text-theme-title shadow-sm'
                      : 'bg-dark-950 border-dark-800 text-dark-500 hover:text-theme-title'
                  }`}
                >
                  <IconHelper name={cat.icon} className="w-3.5 h-3.5" style={{ color: cat.accent }} />
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">Priority</label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as Priority[]).map(p => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                    priority === p
                      ? p === 'high'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500'
                        : p === 'medium'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500'
                        : 'bg-dark-750 text-theme-title border-dark-600'
                      : 'bg-dark-950 border-dark-800 text-dark-500 hover:text-theme-title'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-dark-300 uppercase tracking-wider flex items-center space-x-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-amber-400" />
                <span>Target Deadline (Optional)</span>
              </label>
              {deadline && (
                <button
                  type="button"
                  onClick={() => setDeadline('')}
                  className="text-[11px] text-rose-400 hover:underline"
                >
                  Clear Deadline
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="bg-dark-950 border border-dark-800 rounded-xl px-3 py-2 text-xs text-theme-title focus:outline-none focus:border-theme-accent flex-1"
              />
              <button
                type="button"
                onClick={() => setQuickDeadline(0)}
                className="px-2.5 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-[11px] font-semibold text-amber-300 border border-dark-750"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setQuickDeadline(1)}
                className="px-2.5 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-[11px] font-semibold text-theme-accent-secondary border border-dark-750"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setQuickDeadline(7)}
                className="px-2.5 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-[11px] font-semibold text-theme-accent border border-dark-750"
              >
                1 Week
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-dark-300 uppercase tracking-wider">Notes / Subtext (Optional)</label>
            <textarea
              rows={2}
              placeholder="Add extra context, links, or notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-dark-950 border border-dark-800 rounded-xl px-4 py-2 text-xs text-theme-title placeholder-dark-600 focus:outline-none focus:border-theme-accent transition-colors resize-none"
            />
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
              {initialTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
