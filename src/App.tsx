import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import {
  syncGetCategories, syncGetTasks,
  syncGetCompletions, syncGetOrInitDailyPlan,
  syncAddCategory, syncUpdateCategory, syncDeleteCategory,
  syncAddTask, syncUpdateTask, syncDeleteTask,
  syncAddToToday, syncRemoveFromToday, syncReorderToday,
  syncToggleCompletion,
  getDayStats, formatDateKey, initSync, isServerOnline,
  resetData,
} from './services/syncAdapter';
import { initStorage } from './utils/storage';
import type { ViewMode, Category, Task } from './types';
import { getStoredTheme, applyTheme } from './utils/theme';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { TodayView } from './components/today/TodayView';
import { TasksView } from './components/tasks/TasksView';
import { ProgressView } from './components/progress/ProgressView';
import { HistoryView } from './components/history/HistoryView';
import { SettingsView } from './components/settings/SettingsView';
import { TaskModal } from './components/tasks/TaskModal';
import { CategoryModal } from './components/tasks/CategoryModal';
import { CategoryDeleteModal } from './components/tasks/CategoryDeleteModal';

// Google Client ID for OAuth
const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '87073790500-4ilmlvqndgk06pj6lgbds8lar1qiq4ef.apps.googleusercontent.com';

const MainAppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const todayDate = formatDateKey(new Date());

  const [currentView, setCurrentView] = useState<ViewMode>('today');
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completionsMap, setCompletionsMap] = useState<Record<string, boolean>>({});
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState(false);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const reloadLocalData = () => {
    const loadedCats = syncGetCategories();
    const loadedTasks = syncGetTasks();

    setCategories(loadedCats);
    setTasks(loadedTasks);

    const compRecord: Record<string, boolean> = {};
    syncGetCompletions().forEach(c => {
      if (c.date === todayDate) {
        compRecord[c.taskId] = c.completed;
      }
    });
    setCompletionsMap(compRecord);
  };

  useEffect(() => {
    applyTheme(getStoredTheme());
    initStorage();
    reloadLocalData();

    if (user) {
      initSync(() => {
        setServerOnline(isServerOnline());
        reloadLocalData();
      }).then(() => {
        setServerOnline(isServerOnline());
        reloadLocalData();
      });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center space-y-4 text-theme-accent">
        <div className="w-12 h-12 rounded-2xl bg-dark-900 border border-theme-accent/30 flex items-center justify-center animate-bounce shadow-glow-accent overflow-hidden p-1.5">
          <img src="/logo.png" alt="BROMISE Logo" className="w-full h-full object-contain" />
        </div>
        <span className="text-xs font-semibold tracking-widest uppercase text-dark-400">Loading BROMISE...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const stats = getDayStats(todayDate);
  const todayPlan = syncGetOrInitDailyPlan(todayDate);

  // ─── HANDLERS ─────────────────────────────────────────────
  const handleToggleComplete = async (taskId: string) => {
    const isCompleted = await syncToggleCompletion(taskId, todayDate);
    setCompletionsMap(prev => ({ ...prev, [taskId]: isCompleted }));
  };

  const handleRemoveFromToday = async (taskId: string) => {
    await syncRemoveFromToday(taskId, todayDate);
    reloadLocalData();
  };

  const handleAddToToday = async (taskId: string) => {
    await syncAddToToday(taskId, todayDate);
    reloadLocalData();
  };

  const handleReorderToday = async (reorderedTaskIds: string[]) => {
    await syncReorderToday(todayDate, reorderedTaskIds);
    reloadLocalData();
  };

  const handleSaveTask = async (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> | Partial<Task>,
    id?: string
  ) => {
    if (id) {
      await syncUpdateTask(id, taskData);
    } else {
      await syncAddTask(taskData as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>);
    }
    reloadLocalData();
  };

  const handleDeleteTask = async (taskId: string) => {
    await syncDeleteTask(taskId);
    reloadLocalData();
  };

  const handleSaveCategory = async (
    catData: Omit<Category, 'id' | 'createdAt' | 'position'> | Partial<Category>,
    id?: string
  ) => {
    if (id) {
      await syncUpdateCategory(id, catData);
    } else {
      await syncAddCategory(catData as Omit<Category, 'id' | 'createdAt' | 'position'>);
    }
    reloadLocalData();
  };

  const handleConfirmDeleteCategory = async (
    categoryId: string,
    action: 'move' | 'delete',
    targetCategoryId?: string
  ) => {
    await syncDeleteCategory(categoryId, action, targetCategoryId);
    if (activeCategoryFilter === categoryId) {
      setActiveCategoryFilter(null);
    }
    reloadLocalData();
  };

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 flex font-sans antialiased selection:bg-theme-accent selection:text-white pb-16 md:pb-0 transition-colors duration-200">
      {!serverOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-dark-950 text-xs font-bold text-center py-1 tracking-wide">
          ⚡ Offline mode — changes saved locally and will sync when server reconnects
        </div>
      )}

      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        categories={categories}
        activeCategoryId={activeCategoryFilter}
        onSelectCategoryFilter={catId => setActiveCategoryFilter(catId)}
        onOpenNewCategoryModal={() => {
          setEditingCategory(null);
          setIsCategoryModalOpen(true);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          stats={stats}
          currentView={currentView}
          onOpenNewTaskModal={() => {
            setEditingTask(null);
            setIsTaskModalOpen(true);
          }}
          onOpenNewCategoryModal={() => {
            setEditingCategory(null);
            setIsCategoryModalOpen(true);
          }}
        />

        <main className="flex-1 flex flex-col overflow-y-auto">
          {currentView === 'today' && (
            <TodayView
              todayDate={todayDate}
              stats={stats}
              todayPlan={todayPlan}
              tasks={tasks}
              categories={categories}
              completions={completionsMap}
              onToggleComplete={handleToggleComplete}
              onRemoveFromToday={handleRemoveFromToday}
              onAddToToday={handleAddToToday}
              onReorderToday={handleReorderToday}
              onOpenTaskModal={task => {
                setEditingTask(task || null);
                setIsTaskModalOpen(true);
              }}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {currentView === 'tasks' && (
            <TasksView
              tasks={tasks}
              categories={categories}
              activeCategoryFilter={activeCategoryFilter}
              onSelectCategoryFilter={setActiveCategoryFilter}
              onOpenTaskModal={task => {
                setEditingTask(task || null);
                setIsTaskModalOpen(true);
              }}
              onDeleteTask={handleDeleteTask}
              onOpenCategoryModal={category => {
                setEditingCategory(category || null);
                setIsCategoryModalOpen(true);
              }}
              onOpenDeleteCategoryModal={category => {
                setDeletingCategory(category);
                setIsDeleteCategoryModalOpen(true);
              }}
              onAddToToday={handleAddToToday}
            />
          )}

          {currentView === 'progress' && (
            <ProgressView categories={categories} tasks={tasks} />
          )}

          {currentView === 'history' && (
            <HistoryView categories={categories} tasks={tasks} />
          )}

          {currentView === 'settings' && (
            <SettingsView
              onDataReset={() => { resetData(); reloadLocalData(); }}
              onDataImported={reloadLocalData}
              serverOnline={serverOnline}
            />
          )}
        </main>
      </div>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        categories={categories}
        initialTask={editingTask}
        defaultCategoryId={activeCategoryFilter || categories[0]?.id}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        initialCategory={editingCategory}
      />

      <CategoryDeleteModal
        isOpen={isDeleteCategoryModalOpen}
        category={deletingCategory}
        categories={categories}
        tasks={tasks}
        onClose={() => setIsDeleteCategoryModalOpen(false)}
        onConfirmDelete={handleConfirmDeleteCategory}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
