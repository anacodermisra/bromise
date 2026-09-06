import React, { useState } from 'react';
import type { Category, Task } from '../../types';
import { AlertTriangle, X, ArrowRight, Trash2 } from 'lucide-react';

interface CategoryDeleteModalProps {
  isOpen: boolean;
  category: Category | null;
  categories: Category[];
  tasks: Task[];
  onClose: () => void;
  onConfirmDelete: (categoryId: string, action: 'move' | 'delete', targetCategoryId?: string) => void;
}

export const CategoryDeleteModal: React.FC<CategoryDeleteModalProps> = ({
  isOpen,
  category,
  categories,
  tasks,
  onClose,
  onConfirmDelete,
}) => {
  const [action, setAction] = useState<'move' | 'delete'>('move');
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');

  if (!isOpen || !category) return null;

  const categoryTasks = tasks.filter(t => t.categoryId === category.id);
  const remainingCategories = categories.filter(c => c.id !== category.id);

  const handleConfirm = () => {
    onConfirmDelete(
      category.id,
      action,
      action === 'move' ? targetCategoryId || remainingCategories[0]?.id : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-900 border border-dark-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-dark-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-sans">Delete Category</h3>
              <p className="text-xs text-dark-500">Confirm deletion options for "{category.name}"</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-dark-500 hover:text-white hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-xs text-dark-400">
            This category currently contains <strong className="text-white">{categoryTasks.length} tasks</strong>. What would you like to do with these tasks?
          </p>

          {categoryTasks.length > 0 && remainingCategories.length > 0 && (
            <div className="space-y-3">
              <label
                onClick={() => setAction('move')}
                className={`flex items-start space-x-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  action === 'move'
                    ? 'bg-dark-850 border-violet-500 text-white'
                    : 'bg-dark-950 border-dark-800 text-dark-400 hover:border-dark-700'
                }`}
              >
                <input
                  type="radio"
                  name="deleteAction"
                  checked={action === 'move'}
                  onChange={() => setAction('move')}
                  className="mt-0.5 text-violet-600 focus:ring-violet-500"
                />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-white flex items-center space-x-1">
                    <ArrowRight className="w-3.5 h-3.5 text-violet-400" />
                    <span>Move tasks to another category</span>
                  </div>
                  {action === 'move' && (
                    <select
                      value={targetCategoryId || remainingCategories[0]?.id}
                      onChange={e => setTargetCategoryId(e.target.value)}
                      className="mt-2 w-full bg-dark-950 border border-dark-750 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                    >
                      {remainingCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              <label
                onClick={() => setAction('delete')}
                className={`flex items-start space-x-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                  action === 'delete'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-300'
                    : 'bg-dark-950 border-dark-800 text-dark-400 hover:border-dark-700'
                }`}
              >
                <input
                  type="radio"
                  name="deleteAction"
                  checked={action === 'delete'}
                  onChange={() => setAction('delete')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div className="flex-1 text-xs">
                  <div className="font-bold text-rose-400 flex items-center space-x-1">
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently delete all {categoryTasks.length} tasks</span>
                  </div>
                  <div className="text-[11px] text-dark-500 mt-0.5">
                    This action will remove these tasks from the backlog and today's plan.
                  </div>
                </div>
              </label>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-xs font-semibold text-dark-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg transition-all"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
