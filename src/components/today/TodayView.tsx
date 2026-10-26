import React, { useState, useMemo } from 'react';
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
import { TaskCompletionModal } from './TaskCompletionModal';
import { IconHelper } from '../common/IconHelper';
import { TimetableView } from './TimetableView';
import {
  Calendar,
  CheckCircle2,
  ListTodo,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Sun,
  Moon,
  Zap,
  Clock,
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
  onAssignTimeSlot?: (taskId: string, startTime: string, durationMinutes?: number, endTime?: string, planItemId?: string) => void;
  onRemoveTimeSlot?: (planItemIdOrTaskId: string) => void;
  onTogglePlanSlotComplete?: (planItemId: string) => void;
  onOpenTaskModal: (task?: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onChangeDate?: (date: string) => void;
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
  todayDate,
  stats,
  todayPlan,
  tasks,
  categories,
  completions,
  onToggleComplete,
  onRemoveFromToday,
  onAddToToday,
  onReorderToday,
  onAssignTimeSlot,
  onRemoveTimeSlot,
  onTogglePlanSlotComplete,
  onOpenTaskModal,
  onDeleteTask,
  onChangeDate,
}) => {
  const [scheduleMode, setScheduleMode] = useState<'list' | 'timetable'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [mobileActiveTab, setMobileActiveTab] = useState<'today' | 'backlog'>('today');
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [completedTaskForModal, setCompletedTaskForModal] = useState<Task | null>(null);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Deduplicate tasks in today's plan by unique taskId (so multiple slots show as 1 task with multiple slot badges)
  const todayTasks = useMemo(() => {
    const seen = new Set<string>();
    const list: Task[] = [];
    todayPlan.forEach(planItem => {
      if (!seen.has(planItem.taskId)) {
        seen.add(planItem.taskId);
        const task = tasks.find(t => t.id === planItem.taskId);
        if (task) list.push(task);
      }
    });
    return list;
  }, [todayPlan, tasks]);

  const todayTaskIds = useMemo(() => todayTasks.map(t => t.id), [todayTasks]);

  // Backlog Bucket contains ALL incomplete tasks (and recurring tasks even if completed today)
  const backlogTasks = tasks.filter(task => {
    const isCompletedToday = !!completions[task.id];
    const isArchived = !!task.archivedAt;
    const taskCat = categories.find(c => c.id === task.categoryId);
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      task.title.toLowerCase().includes(q) ||
      (task.notes && task.notes.toLowerCase().includes(q)) ||
      (taskCat && taskCat.name.toLowerCase().includes(q));
    const matchesCat = selectedCategoryFilter ? task.categoryId === selectedCategoryFilter : true;
    return (task.isRecurring || !isCompletedToday) && !isArchived && matchesSearch && matchesCat;
  });

  const backlogByCategory = categories
    .filter(cat => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const catMatches = cat.name.toLowerCase().includes(q);
      const hasMatchingTasks = backlogTasks.some(t => t.categoryId === cat.id);
      return catMatches || hasMatchingTasks;
    })
    .map(cat => ({
      category: cat,
      tasks: backlogTasks.filter(t => t.categoryId === cat.id),
    }));

  const handleToggleCompleteWithConfetti = (taskId: string) => {
    const isCurrentlyCompleted = !!completions[taskId];
    onToggleComplete(taskId);

    if (!isCurrentlyCompleted) {
      const target = tasks.find(t => t.id === taskId);
      if (target && !target.isRecurring) {
        setCompletedTaskForModal(target);
        setIsCompletionModalOpen(true);
      }
    }

    const newCompletedCount = stats.completedCount + (isCurrentlyCompleted ? -1 : 1);
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
    } else if (activeId.startsWith('unscheduled-')) {
      targetTaskId = activeId.replace('unscheduled-', '');
    } else if (activeId.startsWith('slot-')) {
      const planItemId = activeId.replace('slot-', '');
      const existingSlot = todayPlan.find(p => p.id === planItemId);
      if (existingSlot) targetTaskId = existingSlot.taskId;
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

    // Drop onto 24h Timetable hour or half-hour slot
    if (overId.startsWith('hour-slot-')) {
      const timeSlot = overId.replace('hour-slot-', '');

      // Case A: Moving an existing scheduled slot to another hour/half-hour
      if (activeId.startsWith('slot-')) {
        const planItemId = activeId.replace('slot-', '');
        const existingSlot = todayPlan.find(p => p.id === planItemId);
        if (existingSlot && onAssignTimeSlot) {
          onAssignTimeSlot(
            existingSlot.taskId,
            timeSlot,
            existingSlot.durationMinutes || 60,
            undefined,
            planItemId
          );
        }
        return;
      }

      // Case B: Dragging from backlog, unscheduled panel, or today list
      let actualTaskId = activeId;
      if (activeId.startsWith('backlog-')) {
        actualTaskId = activeId.replace('backlog-', '');
      } else if (activeId.startsWith('unscheduled-')) {
        actualTaskId = activeId.replace('unscheduled-', '');
      }

      if (onAssignTimeSlot) {
        onAssignTimeSlot(actualTaskId, timeSlot, 60);
      }
      return;
    }

    if (activeId.startsWith('backlog-')) {
      const actualTaskId = activeId.replace('backlog-', '');
      if (overId === 'today-drop-zone' || todayTaskIds.includes(overId)) {
        onAddToToday(actualTaskId);
      }
      return;
    }

    if (overId === 'backlog-drop-zone') {
      if (activeId.startsWith('unscheduled-')) {
        const actualTaskId = activeId.replace('unscheduled-', '');
        onRemoveFromToday(actualTaskId);
        return;
      }
      if (activeId.startsWith('slot-')) {
        const planItemId = activeId.replace('slot-', '');
        if (onRemoveTimeSlot) {
          onRemoveTimeSlot(planItemId);
          return;
        }
      }
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

  const handlePrevDay = () => {
    if (!onChangeDate) return;
    const d = new Date(todayDate);
    d.setDate(d.getDate() - 1);
    onChangeDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    if (!onChangeDate) return;
    const d = new Date(todayDate);
    d.setDate(d.getDate() + 1);
    onChangeDate(d.toISOString().split('T')[0]);
  };

  const isActuallyToday = todayDate === new Date().toISOString().split('T')[0];

  const getGreetingData = () => {
    const hour = new Date().getHours();
    const remaining = Math.max(0, stats.plannedCount - stats.completedCount);

    let greeting = 'Good morning';
    let Icon = Sun;
    if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
      Icon = Zap;
    } else if (hour >= 17 && hour < 22) {
      greeting = 'Good evening';
      Icon = Moon;
    } else if (hour >= 22 || hour < 5) {
      greeting = 'Late Night Grind';
      Icon = Moon;
    }

    let taskBrief = '';
    if (stats.plannedCount === 0) {
      taskBrief = 'You have no tasks scheduled for today yet. Add daily priorities from your Backlog below!';
    } else if (remaining === 0) {
      taskBrief = `Crushed it! All ${stats.plannedCount} tasks are completed for today.`;
    } else {
      taskBrief = `You have ${stats.plannedCount} tasks today — ${stats.completedCount} done, ${remaining} remaining. Time to execute!`;
    }

    return { greeting, Icon, taskBrief, remaining };
  };

  const { greeting, Icon: GreetingIcon, taskBrief, remaining } = getGreetingData();

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* GOOD MORNING BRIEFING BANNER */}
      <div className="bg-gradient-to-r from-dark-900 via-dark-850 to-dark-900 border border-dark-800 hover:border-theme-accent/30 rounded-3xl p-6 shadow-xl relative overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 w-96 h-96 bg-theme-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-theme-accent font-bold text-xs uppercase tracking-wider">
              <GreetingIcon className="w-4 h-4 text-theme-accent" />
              <span>{greeting}</span>
              <span className="text-dark-600">·</span>
              <span className="text-theme-accent-secondary italic">"Do it for your younger self."</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-theme-title font-sans tracking-tight">
              {isActuallyToday ? `${greeting}, Commander.` : `Log: ${todayDate}`}
            </h2>
            <p className="text-sm text-dark-300 font-medium max-w-xl">
              {taskBrief}
            </p>
            {!isActuallyToday && onChangeDate && (
              <button
                onClick={() => onChangeDate(new Date().toISOString().split('T')[0])}
                className="mt-2 inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-theme-accent/15 hover:bg-theme-accent/25 text-theme-accent text-xs font-bold border border-theme-accent/30 transition-colors"
              >
                <span>Jump to Today's Tasks</span>
              </button>
            )}
          </div>

          <div className="bg-dark-950/80 border border-dark-800 rounded-2xl p-4 min-w-[240px] flex items-center space-x-4 shadow-inner">
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-dark-400 font-medium">Daily Target</span>
                <span className="text-theme-accent font-bold">{stats.percentage}%</span>
              </div>
              <div className="w-full bg-dark-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-theme-accent to-theme-accent-secondary h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.percentage}%` }}
                />
              </div>
              <div className="text-[11px] text-dark-400 font-medium flex justify-between">
                <span>{stats.completedCount} / {stats.plannedCount} completed</span>
                <span className={remaining === 0 && stats.plannedCount > 0 ? 'text-emerald-400 font-bold' : 'text-theme-accent'}>
                  {remaining} left
                </span>
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
          Schedule ({todayTasks.length})
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
            <div className="flex items-center justify-between px-1 flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-theme-accent" />
                <h3 className="text-lg font-bold text-theme-title font-sans">
                  {isActuallyToday ? "Today's Schedule" : `Schedule: ${todayDate}`}
                </h3>
                <span className="bg-dark-800 text-dark-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {todayTasks.length}
                </span>
              </div>

              {/* View Switcher: List vs 24h Timetable */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center bg-dark-900 border border-dark-800 p-0.5 rounded-xl">
                  <button
                    onClick={() => setScheduleMode('list')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      scheduleMode === 'list'
                        ? 'bg-theme-accent text-white shadow-glow-sm'
                        : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setScheduleMode('timetable')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      scheduleMode === 'timetable'
                        ? 'bg-theme-accent text-white shadow-glow-sm'
                        : 'text-dark-400 hover:text-white'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>24h Timetable</span>
                  </button>
                </div>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={handlePrevDay}
                    className="p-1 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-theme-title transition-colors"
                    title="Previous Day"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleNextDay}
                    className="p-1 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-theme-title transition-colors"
                    title="Next Day"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {scheduleMode === 'timetable' ? (
              <TimetableView
                todayDate={todayDate}
                todayPlan={todayPlan}
                tasks={tasks}
                categories={categories}
                completions={completions}
                onToggleComplete={handleToggleCompleteWithConfetti}
                onTogglePlanSlotComplete={onTogglePlanSlotComplete}
                onAssignTimeSlot={(taskId, startTime, durationMinutes, endTime, planItemId) => {
                  if (onAssignTimeSlot) onAssignTimeSlot(taskId, startTime, durationMinutes, endTime, planItemId);
                }}
                onRemoveFromTimeSlot={id => (onRemoveTimeSlot ? onRemoveTimeSlot(id) : onRemoveFromToday(id))}
                onOpenTaskModal={onOpenTaskModal}
                onDeleteTask={onDeleteTask}
              />
            ) : todayTasks.length === 0 ? (
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
                    const taskSlots = todayPlan.filter(p => p.taskId === task.id && (p.startTime || p.timeSlot));
                    return (
                      <TodayTaskItem
                        timeSlots={taskSlots}
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
                  placeholder="Search tasks or categories..."
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

      <TaskCompletionModal
        isOpen={isCompletionModalOpen}
        task={completedTaskForModal}
        category={categories.find(c => c.id === completedTaskForModal?.categoryId)}
        onClose={() => setIsCompletionModalOpen(false)}
        onKeepInBacklog={() => setIsCompletionModalOpen(false)}
        onFinishTask={(taskId) => onDeleteTask(taskId)}
      />
    </div>
  );
};
