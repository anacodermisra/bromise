import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import confetti from 'canvas-confetti';
import type { Task, Category, DayStats, DailyPlanItem } from '../../types';
import { TodayTaskItem } from './TodayTaskItem';
import { BacklogTaskItem } from './BacklogTaskItem';
import { DragOverlayItem } from './DragOverlayItem';
import { IconHelper } from '../common/IconHelper';
import {
  Calendar,
  CheckCircle2,
  ListTodo,
  Plus,
  Search,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface TodayViewProps {
  todayDate: string;
  stats: DayStats;
  todayPlan: DailyPlanItem[];
  tasks: Task[];
  categories: Category[];
  completions: Record<string, boolean>;
  onToggleComplete: (taskId: string) => void;
  onRemoveFromToday: (taskId: string) => void;
  onAddToToday: (taskId: string) => void;
  onReorderToday: (taskIds: string[]) => void;
  onOpenTaskModal: (task?: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

const TodayDropZoneContainer: React.FC<{ children: React.ReactNode; isMobileHidden: boolean }> = ({
  children,
  isMobileHidden,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'today-drop-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`md:col-span-7 space-y-4 transition-all rounded-3xl p-2 flex flex-col h-full min-h-[500px] ${
        isOver ? 'bg-theme-accent/10 ring-2 ring-theme-accent/50' : ''
      } ${isMobileHidden ? 'hidden md:flex' : 'flex'}`}
    >
      {children}
    </div>
  );
};

const BacklogDropZoneContainer: React.FC<{ children: React.ReactNode; isMobileHidden: boolean }> = ({
  children,
  isMobileHidden,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'backlog-drop-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`md:col-span-5 space-y-4 transition-all rounded-3xl p-2 flex flex-col h-full min-h-[500px] ${
        isOver ? 'bg-theme-accent-secondary/10 ring-2 ring-theme-accent-secondary/50' : ''
      } ${isMobileHidden ? 'hidden md:flex' : 'flex'}`}
    >
      {children}
    </div>
  );
};

export const TodayView: React.FC<TodayViewProps> = ({
  stats,
  todayPlan,
  tasks,
  categories,
  completions,
  onToggleComplete,
  onRemoveFromToday,
  onAddToToday,
  onReorderToday,
  onOpenTaskModal,
  onDeleteTask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [mobileActiveTab, setMobileActiveTab] = useState<'today' | 'backlog'>('today');
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const todayTasks = todayPlan
    .map(planItem => tasks.find(t => t.id === planItem.taskId))
    .filter((t): t is Task => t !== undefined);

  const todayTaskIds = todayTasks.map(t => t.id);

  // Backlog Bucket contains ALL incomplete tasks (even those selected for today)
  const backlogTasks = tasks.filter(task => {
    const isCompletedToday = !!completions[task.id];
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategoryFilter ? task.categoryId === selectedCategoryFilter : true;
    return !isCompletedToday && matchesSearch && matchesCat;
  });

  const backlogByCategory = categories.map(cat => ({
    category: cat,
    tasks: backlogTasks.filter(t => t.categoryId === cat.id),
  }));

  const handleToggleCompleteWithConfetti = (taskId: string) => {
    onToggleComplete(taskId);

    const newCompletedCount = stats.completedCount + (completions[taskId] ? -1 : 1);
    if (newCompletedCount === stats.plannedCount && stats.plannedCount > 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#10b981', '#3b82f6', '#f43f5e'],
      });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = String(active.id);
    let targetTaskId = activeId;
    if (activeId.startsWith('backlog-')) {
      targetTaskId = activeId.replace('backlog-', '');
    }
    const foundTask = tasks.find(t => t.id === targetTaskId);
    if (foundTask) {
      setActiveTask(foundTask);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('backlog-')) {
      const actualTaskId = activeId.replace('backlog-', '');
      if (overId === 'today-drop-zone' || todayTaskIds.includes(overId)) {
        onAddToToday(actualTaskId);
      }
      return;
    }

    if (overId === 'backlog-drop-zone') {
      onRemoveFromToday(activeId);
      return;
    }

    if (activeId !== overId && todayTaskIds.includes(activeId) && todayTaskIds.includes(overId)) {
      const oldIndex = todayTaskIds.indexOf(activeId);
      const newIndex = todayTaskIds.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = [...todayTaskIds];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        onReorderToday(reordered);
      }
    }
  };

  const toggleCategoryCollapse = (catId: string) => {
    setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-dark-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-theme-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-theme-accent font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-theme-accent-secondary" />
              <span className="italic text-theme-accent-secondary">"Do it for your younger self."</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-theme-title font-sans tracking-tight">
              BROMISE Execution Dashboard
            </h2>
            <p className="text-sm text-dark-500 max-w-lg">
              Drag tasks freely between Today & Backlog. Reorder daily priorities and complete tasks.
            </p>
          </div>

          <div className="bg-dark-950/80 border border-dark-800 rounded-2xl p-4 min-w-[240px] flex items-center space-x-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-dark-500 font-medium">Completion Rate</span>
                <span className="text-theme-accent font-bold">{stats.percentage}%</span>
              </div>
              <div className="w-full bg-dark-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-theme-accent to-theme-accent-secondary h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.percentage}%` }}
                />
              </div>
              <div className="text-[11px] text-dark-500 font-medium">
                {stats.completedCount} of {stats.plannedCount} tasks completed today
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex md:hidden bg-dark-900 border border-dark-800 rounded-xl p-1">
        <button
          onClick={() => setMobileActiveTab('today')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            mobileActiveTab === 'today'
              ? 'bg-theme-accent text-white shadow-glow-accent'
              : 'text-dark-500 hover:text-theme-title'
          }`}
        >
          Today's Plan ({todayTasks.length})
        </button>
        <button
          onClick={() => setMobileActiveTab('backlog')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
            mobileActiveTab === 'backlog'
              ? 'bg-theme-accent text-white shadow-glow-accent'
              : 'text-dark-500 hover:text-theme-title'
          }`}
        >
          Backlog Bucket ({backlogTasks.length})
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start h-full">
          {/* LEFT/CENTER COLUMN: TODAY'S PLAN */}
          <TodayDropZoneContainer isMobileHidden={mobileActiveTab !== 'today'}>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-theme-accent" />
                <h3 className="text-lg font-bold text-theme-title font-sans">Today's Schedule</h3>
                <span className="bg-dark-800 text-dark-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {todayTasks.length}
                </span>
              </div>
            </div>

            {todayTasks.length === 0 ? (
              <div className="bg-dark-900/60 border border-dashed border-dark-800 rounded-3xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-theme-accent/10 border border-theme-accent/20 text-theme-accent flex items-center justify-center mx-auto">
                  <ListTodo className="w-6 h-6" />
                </div>
                <h4 className="text-base font-semibold text-theme-title">No tasks scheduled for today</h4>
                <p className="text-xs text-dark-500 max-w-sm mx-auto">
                  Drag tasks from the backlog into Today's plan, or click "+ Today" on any task to get started.
                </p>
              </div>
            ) : (
              <SortableContext items={todayTaskIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2.5">
                  {todayTasks.map(task => {
                    const category = categories.find(c => c.id === task.categoryId);
                    const isCompleted = !!completions[task.id];
                    return (
                      <TodayTaskItem
                        key={task.id}
                        task={task}
                        category={category}
                        isCompleted={isCompleted}
                        onToggleComplete={handleToggleCompleteWithConfetti}
                        onRemoveFromToday={onRemoveFromToday}
                        onEditTask={onOpenTaskModal}
                        onDeleteTask={onDeleteTask}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            )}
          </TodayDropZoneContainer>

          {/* RIGHT COLUMN: BACKLOG BUCKET */}
          <BacklogDropZoneContainer isMobileHidden={mobileActiveTab !== 'backlog'}>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-theme-accent-secondary" />
                <h3 className="text-lg font-bold text-theme-title font-sans">Backlog Bucket</h3>
                <span className="bg-dark-800 text-dark-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {backlogTasks.length}
                </span>
              </div>
              <button
                onClick={() => onOpenTaskModal()}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-xs text-theme-accent font-semibold transition-colors border border-dark-700"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-dark-500" />
                <input
                  type="text"
                  placeholder="Filter backlog..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-800 rounded-xl pl-9 pr-4 py-2 text-xs text-theme-title placeholder-dark-500 focus:outline-none focus:border-theme-accent transition-colors"
                />
              </div>

              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategoryFilter(null)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    selectedCategoryFilter === null
                      ? 'bg-theme-accent text-white'
                      : 'bg-dark-900 text-dark-500 hover:text-white border border-dark-800'
                  }`}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryFilter(selectedCategoryFilter === cat.id ? null : cat.id)}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors border ${
                      selectedCategoryFilter === cat.id
                        ? 'bg-dark-800 text-white border-theme-accent'
                        : 'bg-dark-900 text-dark-500 border-dark-800 hover:text-white'
                    }`}
                  >
                    <IconHelper name={cat.icon} className="w-3 h-3" style={{ color: cat.accent }} />
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {backlogTasks.length === 0 ? (
              <div className="bg-dark-900/60 border border-dashed border-dark-800 rounded-2xl p-6 text-center space-y-2">
                <p className="text-xs text-dark-500">No matching backlog tasks found.</p>
                <button
                  onClick={() => onOpenTaskModal()}
                  className="text-xs text-theme-accent font-semibold hover:underline inline-flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create a new task</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
                {backlogByCategory.map(group => {
                  if (group.tasks.length === 0) return null;
                  const isCollapsed = !!collapsedCategories[group.category.id];

                  return (
                    <div key={group.category.id} className="space-y-2">
                      <button
                        onClick={() => toggleCategoryCollapse(group.category.id)}
                        className="w-full flex items-center justify-between px-2 py-1 hover:bg-dark-900/60 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center space-x-2">
                          <IconHelper
                            name={group.category.icon}
                            className="w-4 h-4"
                            style={{ color: group.category.accent }}
                          />
                          <span className="text-xs font-bold text-theme-title uppercase tracking-wider font-sans">
                            {group.category.name}
                          </span>
                          <span className="text-[11px] text-dark-500 font-semibold">
                            ({group.tasks.length})
                          </span>
                        </div>
                        {isCollapsed ? (
                          <ChevronRight className="w-4 h-4 text-dark-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-dark-500" />
                        )}
                      </button>

                      {!isCollapsed && (
                        <div className="space-y-2 pl-1">
                          {group.tasks.map(task => {
                            const isScheduledToday = todayTaskIds.includes(task.id);
                            return (
                              <BacklogTaskItem
                                key={task.id}
                                task={task}
                                category={group.category}
                                isScheduledToday={isScheduledToday}
                                onAddToToday={onAddToToday}
                                onEditTask={onOpenTaskModal}
                                onDeleteTask={onDeleteTask}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </BacklogDropZoneContainer>
        </div>

        <DragOverlay>
          {activeTask ? (
            <DragOverlayItem
              task={activeTask}
              category={categories.find(c => c.id === activeTask.categoryId)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
