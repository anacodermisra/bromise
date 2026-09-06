import React, { useState } from 'react';
import type { Task, Category } from '../../types';
import { IconHelper } from '../common/IconHelper';
import { getDeadlineStatus } from '../../utils/deadlineHelper';
import { Plus, Search, Filter, Pencil, Trash2, Repeat, ArrowUpRight, FolderPlus, CalendarClock } from 'lucide-react';

interface TasksViewProps {
  tasks: Task[];
  categories: Category[];
  activeCategoryFilter: string | null;
  onSelectCategoryFilter: (catId: string | null) => void;
  onOpenTaskModal: (task?: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenCategoryModal: (category?: Category) => void;
  onOpenDeleteCategoryModal: (category: Category) => void;
  onAddToToday: (taskId: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  categories,
  activeCategoryFilter,
  onSelectCategoryFilter,
  onOpenTaskModal,
  onDeleteTask,
  onOpenCategoryModal,
  onOpenDeleteCategoryModal,
  onAddToToday,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [deadlinesOnly, setDeadlinesOnly] = useState(false);

  const filteredTasks = tasks.filter(task => {
    const matchesCat = activeCategoryFilter ? task.categoryId === activeCategoryFilter : true;
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || (task.notes && task.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPriority = priorityFilter === 'all' ? true : task.priority === priorityFilter;
    const matchesRecurring = recurringOnly ? task.isRecurring : true;
    const matchesDeadline = deadlinesOnly ? !!task.deadline : true;
    return matchesCat && matchesSearch && matchesPriority && matchesRecurring && matchesDeadline;
  });

  const priorityColors = {
    low: 'bg-dark-800 text-dark-500 border-dark-750',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-theme-title font-sans">Categories</h3>
            <p className="text-xs text-dark-500">Manage structure, colors, icons, and categories.</p>
          </div>
          <button
            onClick={() => onOpenCategoryModal()}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-theme-accent text-xs font-semibold border border-dark-750 transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-theme-accent" />
            <span>New Category</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <button
            onClick={() => onSelectCategoryFilter(null)}
            className={`p-4 rounded-2xl border text-left transition-all duration-200 ${
              activeCategoryFilter === null
                ? 'bg-gradient-to-tr from-theme-accent/20 to-theme-accent-secondary/10 border-theme-accent/40 text-theme-title shadow-glow-accent'
                : 'bg-dark-900 border-dark-800 text-dark-400 hover:text-theme-title hover:border-dark-750'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-dark-800 flex items-center justify-center mb-3 text-theme-accent">
              <Filter className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold truncate">All Tasks</div>
            <div className="text-xs text-dark-500 mt-1">{tasks.length} total tasks</div>
          </button>

          {categories.map(cat => {
            const isSelected = activeCategoryFilter === cat.id;
            const catTasksCount = tasks.filter(t => t.categoryId === cat.id).length;
            return (
              <div
                key={cat.id}
                onClick={() => onSelectCategoryFilter(isSelected ? null : cat.id)}
                className={`group relative p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'bg-dark-850 border-dark-700 text-theme-title shadow-lg'
                    : 'bg-dark-900 border-dark-800 text-dark-400 hover:text-theme-title hover:border-dark-750'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center border"
                    style={{
                      backgroundColor: `${cat.accent}15`,
                      borderColor: `${cat.accent}30`,
                    }}
                  >
                    <IconHelper name={cat.icon} className="w-4 h-4" style={{ color: cat.accent }} />
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onOpenCategoryModal(cat);
                      }}
                      className="p-1 rounded text-dark-500 hover:text-theme-title hover:bg-dark-750"
                      title="Edit Category"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onOpenDeleteCategoryModal(cat);
                      }}
                      className="p-1 rounded text-dark-500 hover:text-rose-400 hover:bg-dark-750"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="text-sm font-bold truncate">{cat.name}</div>
                <div className="text-xs text-dark-500 mt-1">{catTasksCount} tasks</div>

                <div
                  className="absolute top-2 right-2 w-2 h-2 rounded-full"
                  style={{ backgroundColor: cat.accent }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-dark-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-theme-title font-sans">
              Task Directory {activeCategoryFilter ? `(${categories.find(c => c.id === activeCategoryFilter)?.name})` : ''}
            </h3>
            <p className="text-xs text-dark-500">Showing {filteredTasks.length} tasks</p>
          </div>

          <button
            onClick={() => onOpenTaskModal()}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-theme-accent to-theme-accent-secondary hover:from-theme-accent/90 hover:to-theme-accent-secondary/90 text-white text-xs font-semibold shadow-glow-accent transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Task</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-dark-900 border border-dark-800 p-3 rounded-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-dark-500" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-dark-950 border border-dark-800 rounded-xl pl-9 pr-4 py-2 text-xs text-theme-title placeholder-dark-500 focus:outline-none focus:border-theme-accent transition-colors"
            />
          </div>

          <div className="flex items-center space-x-2 overflow-x-auto">
            <div className="flex items-center bg-dark-950 border border-dark-800 rounded-xl p-1 text-xs">
              {(['all', 'high', 'medium', 'low'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-2.5 py-1 rounded-lg font-semibold uppercase text-[10px] tracking-wider transition-colors ${
                    priorityFilter === p ? 'bg-dark-800 text-theme-title' : 'text-dark-500 hover:text-theme-title'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={() => setDeadlinesOnly(!deadlinesOnly)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                deadlinesOnly
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-dark-950 text-dark-500 border-dark-800 hover:text-theme-title'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>With Deadlines</span>
            </button>

            <button
              onClick={() => setRecurringOnly(!recurringOnly)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                recurringOnly
                  ? 'bg-theme-accent/20 text-theme-accent border-theme-accent/40'
                  : 'bg-dark-950 text-dark-500 border-dark-800 hover:text-theme-title'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Daily Recurring</span>
            </button>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="bg-dark-900/60 border border-dashed border-dark-800 rounded-2xl p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-theme-title">No tasks match your filter criteria.</p>
            <button
              onClick={() => onOpenTaskModal()}
              className="px-4 py-2 rounded-xl bg-theme-accent text-white text-xs font-semibold shadow-glow-accent"
            >
              Add a new task
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTasks.map(task => {
              const cat = categories.find(c => c.id === task.categoryId);
              const deadlineStatus = getDeadlineStatus(task.deadline);
              return (
                <div
                  key={task.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border bg-dark-900 border-dark-800 hover:border-dark-700 hover:bg-dark-850/60 transition-all gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h4 className="text-sm font-bold text-theme-title font-sans truncate">{task.title}</h4>

                      {cat && (
                        <span
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                          style={{
                            backgroundColor: `${cat.accent}15`,
                            color: cat.accent,
                            borderColor: `${cat.accent}30`,
                          }}
                        >
                          <IconHelper name={cat.icon} className="w-3 h-3" style={{ color: cat.accent }} />
                          <span>{cat.name}</span>
                        </span>
                      )}

                      {deadlineStatus && (
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${deadlineStatus.colorClass}`}
                        >
                          <CalendarClock className="w-3 h-3" />
                          <span>{deadlineStatus.text}</span>
                        </span>
                      )}

                      {task.isRecurring && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
                          <Repeat className="w-3 h-3" />
                          <span>Daily Recurring</span>
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border uppercase tracking-wider ${
                          priorityColors[task.priority]
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>

                    {task.notes && <p className="text-xs text-dark-500 truncate">{task.notes}</p>}
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-center">
                    <button
                      onClick={() => onAddToToday(task.id)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-theme-accent/10 hover:bg-theme-accent/20 text-theme-accent text-xs font-semibold border border-theme-accent/20 transition-colors"
                      title="Add to Today's plan"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Add to Today</span>
                    </button>

                    <button
                      onClick={() => onOpenTaskModal(task)}
                      className="p-2 rounded-xl text-dark-500 hover:text-theme-title hover:bg-dark-800 transition-colors"
                      title="Edit task"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-2 rounded-xl text-dark-500 hover:text-rose-400 hover:bg-dark-800 transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
