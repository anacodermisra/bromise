import React, { useState, useEffect, useRef } from 'react';
import type { Task, Category, Priority, SubTask } from '../../types';
import { X, Sparkles, Repeat, CalendarClock, Plus, Trash2, CheckSquare, Square, ListChecks } from 'lucide-react';
import { IconHelper } from '../common/IconHelper';
import { api } from '../../services/api';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> | Partial<Task>, id?: string) => void;
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
  const [isRecurring, setIsRecurring] = useState(false);

  // Sub-tasks state
  const [subtasks, setSubtasks] = useState<SubTask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [subtasksLoading, setSubtasksLoading] = useState(false);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setNotes(initialTask.notes || '');
      setCategoryId(initialTask.categoryId);
      setPriority(initialTask.priority);
      setDeadline(initialTask.deadline || '');
      setIsRecurring(!!initialTask.isRecurring);
      // Load subtasks from embedded data or fetch
      if (initialTask.subtasks) {
        setSubtasks(initialTask.subtasks);
      } else {
        setSubtasksLoading(true);
        api.getSubtasks(initialTask.id)
          .then(data => setSubtasks(data))
          .catch(() => setSubtasks([]))
          .finally(() => setSubtasksLoading(false));
      }
    } else {
      setTitle('');
      setNotes('');
      setCategoryId(defaultCategoryId || (categories[0]?.id || ''));
      setPriority('medium');
      setDeadline('');
      setIsRecurring(false);
      setSubtasks([]);
    }
    setNewSubtaskTitle('');
  }, [initialTask, defaultCategoryId, categories, isOpen]);

  if (!isOpen) return null;

  const setQuickDeadline = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setDeadline(d.toISOString().split('T')[0]);
  };

  const handleAddSubtask = async () => {
    const t = newSubtaskTitle.trim();
    if (!t) return;
    setNewSubtaskTitle('');
    if (initialTask) {
      // Immediately save to server if editing existing task
      try {
        const created = await api.createSubtask(initialTask.id, { title: t });
        setSubtasks(prev => [...prev, created]);
      } catch (err) {
        console.error('Failed to create subtask', err);
      }
    } else {
      // For new tasks, buffer locally. We'll save after task creation.
      const tempSubtask: SubTask = {
        id: `temp-${Date.now()}`,
        taskId: '',
        title: t,
        done: false,
        position: subtasks.length,
        createdAt: new Date().toISOString(),
      };
      setSubtasks(prev => [...prev, tempSubtask]);
    }
    subtaskInputRef.current?.focus();
  };

  const handleToggleSubtask = async (subtask: SubTask) => {
    if (initialTask) {
      try {
        const updated = await api.updateSubtask(initialTask.id, subtask.id, { done: !subtask.done });
        setSubtasks(prev => prev.map(s => s.id === subtask.id ? updated : s));
      } catch (err) {
        console.error('Failed to toggle subtask', err);
      }
    } else {
      setSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, done: !s.done } : s));
    }
  };

  const handleDeleteSubtask = async (subtask: SubTask) => {
    if (initialTask && !subtask.id.startsWith('temp-')) {
      try {
        await api.deleteSubtask(initialTask.id, subtask.id);
      } catch (err) {
        console.error('Failed to delete subtask', err);
      }
    }
    setSubtasks(prev => prev.filter(s => s.id !== subtask.id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !categoryId) return;

    const pendingSubtasks = subtasks.filter(s => s.id.startsWith('temp-'));

    if (initialTask) {
      onSave(
        {
          title: title.trim(),
          notes: notes.trim() || undefined,
          categoryId,
          priority,
          deadline: deadline || undefined,
          isRecurring,
          recurrenceRule: isRecurring
            ? {
                id: initialTask.recurrenceRule?.id || `rec-${Date.now()}`,
                taskId: initialTask.id,
                frequency: 'daily',
                active: true,
                startDate: new Date().toISOString().split('T')[0],
              }
            : undefined,
        },
        initialTask.id
      );
    } else {
      // Pass pending subtasks via a custom field for App.tsx to handle after creation
      onSave({
        title: title.trim(),
        notes: notes.trim() || undefined,
        categoryId,
        priority,
        deadline: deadline || undefined,
        isRecurring,
        recurrenceRule: isRecurring
          ? {
              id: `rec-${Date.now()}`,
              taskId: '',
              frequency: 'daily',
              active: true,
              startDate: new Date().toISOString().split('T')[0],
            }
          : undefined,
        // @ts-ignore — extra field consumed by App.tsx onSave handler
        _pendingSubtasks: pendingSubtasks.map(s => s.title),
      });
    }
    onClose();
  };

  const doneCount = subtasks.filter(s => s.done).length;
  const totalCount = subtasks.length;

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
              placeholder="Add extra context, links, or subtasks..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-dark-950 border border-dark-800 rounded-xl px-4 py-2 text-xs text-theme-title placeholder-dark-600 focus:outline-none focus:border-theme-accent transition-colors resize-none"
            />
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-dark-950 border border-dark-800">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-xl bg-theme-accent/10 border border-theme-accent/20 text-theme-accent flex items-center justify-center">
                <Repeat className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-theme-title">Repeat Daily</div>
                <div className="text-[11px] text-dark-500">Auto-instantiate in daily plan every morning</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`w-11 h-6 rounded-full transition-colors relative p-1 ${
                isRecurring ? 'bg-theme-accent' : 'bg-dark-800'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isRecurring ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* ─── SUB-TASKS ─── */}
          <div className="space-y-3 p-4 rounded-2xl bg-dark-950 border border-dark-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ListChecks className="w-4 h-4 text-theme-accent" />
                <span className="text-xs font-bold text-dark-300 uppercase tracking-wider">Sub-tasks</span>
                {totalCount > 0 && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
                    {doneCount}/{totalCount}
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="w-full bg-dark-800 rounded-full h-1.5">
                <div
                  className="bg-gradient-to-r from-theme-accent to-theme-accent-secondary h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }}
                />
              </div>
            )}

            {/* Sub-task list */}
            {subtasksLoading ? (
              <p className="text-[11px] text-dark-500 text-center py-2">Loading steps...</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {subtasks.map(sub => (
                  <div
                    key={sub.id}
                    className="flex items-center space-x-2 group p-2 rounded-xl hover:bg-dark-900 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleSubtask(sub)}
                      className="flex-shrink-0 text-dark-500 hover:text-theme-accent transition-colors"
                    >
                      {sub.done ? (
                        <CheckSquare className="w-4 h-4 text-theme-accent" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-xs transition-all ${
                        sub.done ? 'line-through text-dark-600' : 'text-dark-200'
                      }`}
                    >
                      {sub.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(sub)}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-dark-600 hover:text-rose-400 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new sub-task */}
            <div className="flex items-center space-x-2">
              <input
                ref={subtaskInputRef}
                type="text"
                placeholder="Add a step... (e.g. Research competitors)"
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); } }}
                className="flex-1 bg-dark-900 border border-dark-800 rounded-xl px-3 py-2 text-xs text-theme-title placeholder-dark-600 focus:outline-none focus:border-theme-accent transition-colors"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                disabled={!newSubtaskTitle.trim()}
                className="flex-shrink-0 p-2 rounded-xl bg-theme-accent/20 hover:bg-theme-accent/30 text-theme-accent border border-theme-accent/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
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
              {initialTask ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
