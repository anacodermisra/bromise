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
  syncAssignTimeSlot, syncRemoveTimeSlot, syncTogglePlanItemCompletion,
  syncToggleCompletion,
  getDayStats, formatDateKey, initSync, isServerOnline,
  resetData, pullFromServer
} from './services/syncAdapter';
import { initStorage, setActiveUser } from './utils/storage';
import type { ViewMode, Category, Task } from './types';
import {
  getStoredTheme,
  applyTheme,
  isWinterArcSnowEnabled,
  isWinterArcWallpaperEnabled,
  type ThemeId,
} from './utils/theme';
import { SnowEffect } from './components/common/SnowEffect';
import { ErrorBoundary } from './components/common/ErrorBoundary';
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

// Sanitize Google Client ID to prevent "401 Malformed" errors from trailing spaces or quotes in Env Vars
let rawClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
rawClientId = rawClientId.trim().replace(/['"]/g, '');
const GOOGLE_CLIENT_ID = rawClientId || '87073790500-4ilmlvqndgk06pj6lgbds8lar1qiq4ef.apps.googleusercontent.com';

const MainAppContent: React.FC = () => {
  const { user, loading } = useAuth();

  const [currentTheme, setCurrentTheme] = useState<ThemeId>(getStoredTheme());
  const [showWinterSnow, setShowWinterSnow] = useState<boolean>(isWinterArcSnowEnabled());
  const [showWinterWallpaper, setShowWinterWallpaper] = useState<boolean>(isWinterArcWallpaperEnabled());

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<ThemeId>;
      if (customEvent.detail) {
        setCurrentTheme(customEvent.detail);
      }
    };
    const handleWinterFxChange = () => {
      setShowWinterSnow(isWinterArcSnowEnabled());
      setShowWinterWallpaper(isWinterArcWallpaperEnabled());
    };
    window.addEventListener('bromise-theme-change', handleThemeChange);
    window.addEventListener('bromise-winter-fx-change', handleWinterFxChange);
    return () => {
      window.removeEventListener('bromise-theme-change', handleThemeChange);
      window.removeEventListener('bromise-winter-fx-change', handleWinterFxChange);
    };
  }, []);

  const [currentView, setCurrentView] = useState<ViewMode>('today');
  const [selectedDate, setSelectedDate] = useState<string>(formatDateKey(new Date()));
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
      if (c.date === selectedDate) {
        compRecord[c.taskId] = c.completed;
      }
    });
    setCompletionsMap(compRecord);
  };

  useEffect(() => {
    reloadLocalData();
  }, [selectedDate]);

  // Midnight auto-rollover & morning tab focus detection
  useEffect(() => {
    const handleCheckDate = () => {
      const todayKey = formatDateKey(new Date());
      setSelectedDate(prev => {
        // If current selected date is older than today, auto-roll to today
        if (prev < todayKey) {
          return todayKey;
        }
        return prev;
      });
      reloadLocalData();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleCheckDate();
      }
    };

    const timer = setInterval(handleCheckDate, 30_000);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  useEffect(() => {
    applyTheme(getStoredTheme());
    setActiveUser(user ? user.id : null);
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
    } else {
      setCategories([]);
      setTasks([]);
      setCompletionsMap({});
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

  const stats = getDayStats(selectedDate);
  const todayPlan = syncGetOrInitDailyPlan(selectedDate);

  // ─── HANDLERS ─────────────────────────────────────────────
  const handleToggleComplete = async (taskId: string) => {
    const isCompleted = await syncToggleCompletion(taskId, selectedDate);
    setCompletionsMap(prev => ({ ...prev, [taskId]: isCompleted }));
  };

  const handleRemoveFromToday = async (taskId: string) => {
    await syncRemoveFromToday(taskId, selectedDate);
    reloadLocalData();
  };

  const handleAddToToday = async (taskId: string) => {
    await syncAddToToday(taskId, selectedDate);
    reloadLocalData();
  };

  const handleReorderToday = async (reorderedTaskIds: string[]) => {
    await syncReorderToday(selectedDate, reorderedTaskIds);
    reloadLocalData();
  };

  const handleAssignTimeSlot = async (
    taskId: string,
    startTime: string,
    durationMinutes: number = 60,
    endTime?: string,
    planItemId?: string
  ) => {
    await syncAssignTimeSlot(selectedDate, taskId, startTime, durationMinutes, endTime, planItemId);
    reloadLocalData();
  };

  const handleRemoveTimeSlot = async (planItemIdOrTaskId: string) => {
    await syncRemoveTimeSlot(planItemIdOrTaskId);
    reloadLocalData();
  };

  const handleTogglePlanSlotComplete = async (planItemId: string) => {
    await syncTogglePlanItemCompletion(planItemId);
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
    // Always pull fresh data from server so tasks are up to date
    if (serverOnline) {
      await pullFromServer();
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
    <div
      className={`h-screen overflow-hidden text-dark-100 flex font-sans antialiased selection:bg-theme-accent selection:text-white pb-16 md:pb-0 transition-colors duration-200 relative ${
        currentTheme === 'winter-arc' && showWinterWallpaper ? 'bg-transparent' : 'bg-dark-950'
      }`}
    >
      {/* Winter Arc Atmospheric Samurai Background */}
      {currentTheme === 'winter-arc' && showWinterWallpaper && (
        <div
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
          style={{
            backgroundImage: 'url(/winter-arc-bg.jpg)',
          }}
        >
          {/* Subtle balanced dark vignette overlay ensuring crisp artwork visibility and text contrast */}
          <div className="absolute inset-0 bg-dark-950/45 backdrop-blur-[0.5px]" />
          <div className="absolute inset-0 bg-gradient-to-b from-dark-950/50 via-transparent to-dark-950/65" />
        </div>
      )}

      {/* Winter Arc Dynamic Falling Snow Animation */}
      {currentTheme === 'winter-arc' && showWinterSnow && <SnowEffect />}

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

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative z-10">
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

        <main className="flex-1 flex flex-col overflow-y-auto min-h-0">
          <ErrorBoundary>
            {currentView === 'today' && (
              <TodayView
                todayDate={selectedDate}
                onChangeDate={setSelectedDate}
                stats={stats}
                todayPlan={todayPlan}
                tasks={tasks}
                categories={categories}
                completions={completionsMap}
                onToggleComplete={handleToggleComplete}
                onRemoveFromToday={handleRemoveFromToday}
                onAddToToday={handleAddToToday}
                onReorderToday={handleReorderToday}
                onAssignTimeSlot={handleAssignTimeSlot}
                onRemoveTimeSlot={handleRemoveTimeSlot}
                onTogglePlanSlotComplete={handleTogglePlanSlotComplete}
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
          </ErrorBoundary>
        </main>
      </div>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={async () => {
          setIsTaskModalOpen(false);
          if (serverOnline) {
            await pullFromServer();
            reloadLocalData();
          }
        }}
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
