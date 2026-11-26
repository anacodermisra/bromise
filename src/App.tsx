import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { CheckCircle2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import {
  syncGetCategories, syncGetTasks,
  syncGetCompletions, syncGetOrInitDailyPlan,
  syncAddCategory, syncUpdateCategory, syncDeleteCategory,
  syncAddTask, syncUpdateTask, syncDeleteTask, syncFinishTask,
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
import { UpdateAnnouncementModal } from './components/common/UpdateAnnouncementModal';
import { GymRoomView } from './components/gym/GymRoomView';
import { StudyRoomView } from './components/study/StudyRoomView';
import {
  getStoredWallpaperConfig,
  getActiveWallpaperUrl,
  DARK_GYM_WALLPAPER,
  DARK_LIBRARY_WALLPAPER,
} from './utils/wallpaper';
import type { WallpaperConfig } from './types';

// Sanitize Google Client ID to prevent "401 Malformed" errors from trailing spaces or quotes in Env Vars
let rawClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
rawClientId = rawClientId.trim().replace(/['"]/g, '');

if (!rawClientId) {
  console.error('VITE_GOOGLE_CLIENT_ID is not set. Google authentication will not work.');
}

const GOOGLE_CLIENT_ID = rawClientId || '87073790500-4ilmlvqndgk06pj6lgbds8lar1qiq4ef.apps.googleusercontent.com';

const MainAppContent: React.FC = () => {
  const { user, loading } = useAuth();

  const [currentTheme, setCurrentTheme] = useState<ThemeId>(getStoredTheme());
  const [showWinterSnow, setShowWinterSnow] = useState<boolean>(isWinterArcSnowEnabled());
  const [showWinterWallpaper, setShowWinterWallpaper] = useState<boolean>(isWinterArcWallpaperEnabled());
  const [wallpaperConfig, setWallpaperConfig] = useState<WallpaperConfig>(getStoredWallpaperConfig());

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
    const handleWallpaperChange = (e: Event) => {
      const customEvent = e as CustomEvent<WallpaperConfig>;
      if (customEvent.detail) {
        setWallpaperConfig(customEvent.detail);
      } else {
        setWallpaperConfig(getStoredWallpaperConfig());
      }
    };
    window.addEventListener('bromise-theme-change', handleThemeChange);
    window.addEventListener('bromise-winter-fx-change', handleWinterFxChange);
    window.addEventListener('bromise-wallpaper-change', handleWallpaperChange);
    return () => {
      window.removeEventListener('bromise-theme-change', handleThemeChange);
      window.removeEventListener('bromise-winter-fx-change', handleWinterFxChange);
      window.removeEventListener('bromise-wallpaper-change', handleWallpaperChange);
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
  const [defaultCategoryIdForTask, setDefaultCategoryIdForTask] = useState<string | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [isDeleteCategoryModalOpen, setIsDeleteCategoryModalOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(true);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  useEffect(() => {
    const handleOpenUpdate = () => setIsUpdateModalOpen(true);
    window.addEventListener('bromise-open-update-modal', handleOpenUpdate);
    return () => window.removeEventListener('bromise-open-update-modal', handleOpenUpdate);
  }, []);

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
        const prevDate = new Date(prev);
        const currentDate = new Date(todayKey);
        if (prevDate < currentDate) {
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

    // Check every 10 seconds for date changes
    const timer = setInterval(handleCheckDate, 10_000);

    // Also schedule a check at next midnight
    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();

      return setTimeout(() => {
        handleCheckDate();
        scheduleNextMidnight(); // Schedule next day's midnight
      }, msUntilMidnight);
    };

    const midnightTimer = scheduleNextMidnight();

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(timer);
      clearTimeout(midnightTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, []);

  useEffect(() => {
    applyTheme(getStoredTheme());
    setActiveUser(user ? user.id : null);

    if (user) {
      initStorage();
      reloadLocalData();
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
    try {
      const isCompleted = await syncToggleCompletion(taskId, selectedDate);
      setCompletionsMap(prev => ({ ...prev, [taskId]: isCompleted }));
    } catch (error) {
      console.error('Failed to toggle completion:', error);
    }
  };

  const handleRemoveFromToday = async (taskId: string) => {
    try {
      await syncRemoveFromToday(taskId, selectedDate);
      reloadLocalData();
    } catch (error) {
      console.error('Failed to remove task from today:', error);
    }
  };

  const handleAddToToday = async (taskId: string) => {
    try {
      await syncAddToToday(taskId, selectedDate);
      reloadLocalData();
    } catch (error) {
      console.error('Failed to add task to today:', error);
    }
  };

  const handleReorderToday = async (reorderedTaskIds: string[]) => {
    try {
      await syncReorderToday(selectedDate, reorderedTaskIds);
      reloadLocalData();
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
    }
  };

  const handleAssignTimeSlot = async (
    taskId: string,
    startTime: string,
    durationMinutes: number = 60,
    endTime?: string,
    planItemId?: string
  ) => {
    try {
      await syncAssignTimeSlot(selectedDate, taskId, startTime, durationMinutes, endTime, planItemId);
      reloadLocalData();
    } catch (error) {
      console.error('Failed to assign time slot:', error);
    }
  };

  const handleRemoveTimeSlot = async (planItemIdOrTaskId: string) => {
    try {
      await syncRemoveTimeSlot(planItemIdOrTaskId);
      reloadLocalData();
    } catch (error) {
      console.error('Failed to remove time slot:', error);
    }
  };

  const handleTogglePlanSlotComplete = async (planItemId: string) => {
    try {
      await syncTogglePlanItemCompletion(planItemId);
      reloadLocalData();
    } catch (error) {
      console.error('Failed to toggle plan slot completion:', error);
    }
  };

  const handleSaveTask = (
    taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> | Partial<Task>,
    id?: string
  ) => {
    try {
      // Both sync helpers write to LocalStorage synchronously before awaiting
      // the API, so the UI can update immediately while the server catches up.
      const savePromise = id
        ? syncUpdateTask(id, taskData)
        : syncAddTask(taskData as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>);

      reloadLocalData();
      setToastMessage(id ? 'Changes saved' : 'Task added');

      savePromise
        .then(() => (serverOnline ? pullFromServer() : undefined))
        .then(() => reloadLocalData())
        .catch((error) => {
          console.error('Failed to save task:', error);
          alert('Failed to save task. Please try again.');
        });
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('Failed to save task. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await syncDeleteTask(taskId, selectedDate);
      reloadLocalData();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleFinishTask = async (taskId: string) => {
    try {
      await syncFinishTask(taskId, selectedDate);
      reloadLocalData();
      setToastMessage('Task completed & archived 🎉');
    } catch (error) {
      console.error('Failed to finish task:', error);
    }
  };

  const handleSaveCategory = async (
    catData: Omit<Category, 'id' | 'createdAt' | 'position'> | Partial<Category>,
    id?: string
  ) => {
    try {
      if (id) {
        await syncUpdateCategory(id, catData);
        setToastMessage('Category updated 🎉');
      } else {
        await syncAddCategory(catData as Omit<Category, 'id' | 'createdAt' | 'position'>);
        setToastMessage('Category created 🎉');
      }
      reloadLocalData();
    } catch (error) {
      console.error('Failed to save category:', error);
      alert('Failed to save category. Please try again.');
    }
  };

  const handleConfirmDeleteCategory = async (
    categoryId: string,
    action: 'move' | 'delete',
    targetCategoryId?: string
  ) => {
    try {
      await syncDeleteCategory(categoryId, action, targetCategoryId);
      if (activeCategoryFilter === categoryId) {
        setActiveCategoryFilter(null);
      }
      reloadLocalData();
      setToastMessage('Category deleted 🗑️');
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category. Please try again.');
    }
  };

  const isGymRoom = currentView === 'gym';
  const isStudyRoom = currentView === 'study';
  const isDedicatedRoomView = isGymRoom || isStudyRoom;

  const activeWallpaperUrl = isGymRoom
    ? DARK_GYM_WALLPAPER
    : isStudyRoom
    ? DARK_LIBRARY_WALLPAPER
    : getActiveWallpaperUrl(wallpaperConfig, currentView);

  const isAtmosphericBackgroundActive =
    isDedicatedRoomView ||
    (wallpaperConfig.enabled && !!activeWallpaperUrl) ||
    (currentTheme === 'winter-arc' && showWinterWallpaper);

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div
      className={`h-screen overflow-hidden text-dark-100 flex font-sans antialiased selection:bg-theme-accent selection:text-white pb-16 md:pb-0 transition-colors duration-200 relative ${
        isAtmosphericBackgroundActive ? 'bg-transparent' : 'bg-dark-950'
      }`}
    >
      {/* Dynamic Custom & Room Wallpaper Background Layer */}
      {isAtmosphericBackgroundActive && activeWallpaperUrl && (
        <div
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700 ease-out"
          style={{
            backgroundImage: activeWallpaperUrl ? `url(${JSON.stringify(activeWallpaperUrl)})` : undefined,
            filter:
              wallpaperConfig.blurPx > 0 && !isDedicatedRoomView
                ? `blur(${wallpaperConfig.blurPx}px)`
                : undefined,
            transform: wallpaperConfig.blurPx > 0 && !isDedicatedRoomView ? 'scale(1.04)' : undefined,
          }}
        >
          {/* Configurable Dimming & Vignette */}
          <div
            className="absolute inset-0 bg-dark-950 transition-opacity duration-300"
            style={{
              opacity: isGymRoom
                ? 0.35
                : isStudyRoom
                ? 0.35
                : (wallpaperConfig.dimOpacity ?? 0.45),
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-dark-950/60 via-transparent to-dark-950/70" />
        </div>
      )}

      {/* Winter Arc Dynamic Falling Snow Animation */}
      {currentTheme === 'winter-arc' && showWinterSnow && <SnowEffect />}

      {!serverOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500/90 text-dark-950 text-xs font-bold text-center py-1 tracking-wide">
          ⚡ Offline mode — changes saved locally and will sync when server reconnects
        </div>
      )}

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] pointer-events-none flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-dark-900/95 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-[0_0_30px_-8px_rgba(16,185,129,0.5)] animate-fade-in backdrop-blur-md"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
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
        onOpenCategoryModal={category => {
          setEditingCategory(category);
          setIsCategoryModalOpen(true);
        }}
        onOpenDeleteCategoryModal={category => {
          setDeletingCategory(category);
          setIsDeleteCategoryModalOpen(true);
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
                onOpenTaskModal={(task, defaultCategoryId) => {
                  setEditingTask(task || null);
                  if (defaultCategoryId) {
                    setDefaultCategoryIdForTask(defaultCategoryId);
                  }
                  setIsTaskModalOpen(true);
                }}
                onDeleteTask={handleDeleteTask}
                onFinishTask={handleFinishTask}
                onOpenCategoryModal={category => {
                  setEditingCategory(category || null);
                  setIsCategoryModalOpen(true);
                }}
                onOpenDeleteCategoryModal={category => {
                  setDeletingCategory(category);
                  setIsDeleteCategoryModalOpen(true);
                }}
              />
            )}

            {currentView === 'tasks' && (
              <TasksView
                tasks={tasks}
                categories={categories}
                activeCategoryFilter={activeCategoryFilter}
                onSelectCategoryFilter={setActiveCategoryFilter}
                onOpenTaskModal={(task, defaultCategoryId) => {
                  setEditingTask(task || null);
                  if (defaultCategoryId) {
                    setDefaultCategoryIdForTask(defaultCategoryId);
                  }
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

            {currentView === 'gym' && (
              <GymRoomView
                onPushToToday={async (exerciseName, notes) => {
                  let targetCat = categories.find(c =>
                    c.name.toLowerCase().includes('gym') ||
                    c.name.toLowerCase().includes('fitness') ||
                    c.name.toLowerCase().includes('health') ||
                    c.name.toLowerCase().includes('workout')
                  );
                  if (!targetCat && categories.length > 0) {
                    targetCat = categories[0];
                  }
                  const newTask = await syncAddTask({
                    title: `Workout: ${exerciseName}`,
                    categoryId: targetCat ? targetCat.id : 'cat-default',
                    notes: notes || 'Scheduled from Iron Sanctuary Gym Room',
                    priority: 'medium',
                    isRecurring: false,
                  });
                  if (newTask) {
                    await syncAddToToday(newTask.id, selectedDate);
                    reloadLocalData();
                  }
                }}
              />
            )}

            {currentView === 'study' && (
              <StudyRoomView
                onPushToToday={async (subject, chapterTitle) => {
                  let targetCat = categories.find(c =>
                    c.name.toLowerCase().includes('study') ||
                    c.name.toLowerCase().includes('learn') ||
                    c.name.toLowerCase().includes('read') ||
                    c.name.toLowerCase().includes('work')
                  );
                  if (!targetCat && categories.length > 0) {
                    targetCat = categories[0];
                  }
                  const newTask = await syncAddTask({
                    title: `Study: ${subject} - ${chapterTitle}`,
                    categoryId: targetCat ? targetCat.id : 'cat-default',
                    notes: `Deep work chapter from Library Bookshelf`,
                    priority: 'high',
                    isRecurring: false,
                  });
                  if (newTask) {
                    await syncAddToToday(newTask.id, selectedDate);
                    reloadLocalData();
                  }
                }}
              />
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
        onClose={() => {
          setIsTaskModalOpen(false);
          setDefaultCategoryIdForTask(null);
        }}
        onSave={handleSaveTask}
        categories={categories}
        initialTask={editingTask}
        defaultCategoryId={defaultCategoryIdForTask || activeCategoryFilter || categories[0]?.id}
      />

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        onDelete={category => {
          setDeletingCategory(category);
          setIsDeleteCategoryModalOpen(true);
        }}
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

      <UpdateAnnouncementModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
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
