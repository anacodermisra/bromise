import React, { useState } from 'react';
import type { ViewMode, Category } from '../../types';
import { IconHelper } from '../common/IconHelper';
import { CalendarCheck, CheckSquare, BarChart3, History, Settings, Plus, Download, Share, X, LogOut } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  currentView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  categories: Category[];
  activeCategoryId?: string | null;
  onSelectCategoryFilter?: (catId: string | null) => void;
  onOpenNewCategoryModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  categories,
  activeCategoryId,
  onSelectCategoryFilter,
  onOpenNewCategoryModal,
}) => {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const { user, logout } = useAuth();
  const [showIOSHint, setShowIOSHint] = useState(false);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSHint(true);
    } else {
      await promptInstall();
    }
  };
  const navItems: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'Today', icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'tasks', label: 'Backlog & Tasks', icon: <CheckSquare className="w-5 h-5" /> },
    { id: 'progress', label: 'Analytics', icon: <BarChart3 className="w-5 h-5" /> },
    { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <>
      <aside className="hidden md:flex flex-col w-64 border-r border-dark-800 bg-dark-900/80 backdrop-blur-xl h-screen sticky top-0 z-30 select-none">
        <div className="p-6 border-b border-dark-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-dark-900 border border-theme-accent/30 flex items-center justify-center shadow-glow-accent overflow-hidden flex-shrink-0 p-1">
              <img
                src="/logo.png"
                alt="BROMISE Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wider text-theme-title font-sans">BROMISE</h1>
              <p className="text-[10px] text-theme-accent opacity-90 font-semibold italic">Do it for your younger self.</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          <div className="space-y-1">
            <div className="px-3 text-[11px] font-semibold text-dark-500 uppercase tracking-wider mb-2">
              Main Views
            </div>
            {navItems.map(item => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectView(item.id)}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-theme-accent/20 to-theme-accent-secondary/10 text-theme-accent border border-theme-accent/30 shadow-sm'
                      : 'text-dark-500 hover:text-theme-title hover:bg-dark-850'
                  }`}
                >
                  <span className={isActive ? 'text-theme-accent' : 'text-dark-500'}>{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-theme-accent shadow-glow-accent" />}
                </button>
              );
            })}
          </div>

          <div className="space-y-1 pt-4 border-t border-dark-850">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[11px] font-semibold text-dark-500 uppercase tracking-wider">Categories</span>
              <button
                onClick={onOpenNewCategoryModal}
                className="text-dark-500 hover:text-theme-accent p-1 rounded-lg hover:bg-dark-800 transition-colors"
                title="Add Category"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => {
                onSelectView('tasks');
                if (onSelectCategoryFilter) onSelectCategoryFilter(null);
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                activeCategoryId === null && currentView === 'tasks'
                  ? 'text-theme-title bg-dark-800 border border-dark-700'
                  : 'text-dark-500 hover:text-theme-title hover:bg-dark-850'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-dark-500" />
              <span>All Categories</span>
            </button>

            {categories.map(cat => {
              const isSelected = activeCategoryId === cat.id && currentView === 'tasks';
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    onSelectView('tasks');
                    if (onSelectCategoryFilter) onSelectCategoryFilter(cat.id);
                  }}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isSelected ? 'text-theme-title bg-dark-800 border border-dark-700' : 'text-dark-500 hover:text-theme-title hover:bg-dark-850'
                  }`}
                >
                  <IconHelper name={cat.icon} className="w-3.5 h-3.5" style={{ color: cat.accent }} />
                  <span className="truncate flex-1 text-left">{cat.name}</span>
                  <div
                    className="w-1.5 h-1.5 rounded-full opacity-80"
                    style={{ backgroundColor: cat.accent }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-dark-850 space-y-3">
          {/* User Profile Card & Logout */}
          {user && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-dark-850/80 border border-dark-800">
              <div className="flex items-center space-x-2.5 min-w-0">
                {user.picture ? (
                  <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-theme-accent/20 text-theme-accent flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-theme-title truncate">{user.name}</div>
                  <div className="text-[10px] text-dark-500 truncate">{user.email}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="text-dark-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-dark-800 transition-colors flex-shrink-0"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Install App Button */}
          {!isInstalled && (canInstall || isIOS) && (
            <button
              onClick={handleInstallClick}
              className="w-full flex items-center justify-center space-x-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-theme-accent/20 to-theme-accent-secondary/10 hover:from-theme-accent/30 hover:to-theme-accent-secondary/20 text-theme-accent border border-theme-accent/30 text-xs font-semibold transition-all duration-200 hover:shadow-glow-accent group"
            >
              <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span>Install BROMISE App</span>
            </button>
          )}
          {isInstalled && (
            <div className="flex items-center space-x-2 px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="text-[10px] text-emerald-400 font-medium">App Installed</span>
            </div>
          )}
        </div>
      </aside>

      {/* iOS Install Instructions Modal */}
      {showIOSHint && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm md:items-center" onClick={() => setShowIOSHint(false)}>
          <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-theme-title">Install on iPhone / iPad</h3>
              <button onClick={() => setShowIOSHint(false)} className="text-dark-500 hover:text-theme-title p-1 rounded-lg hover:bg-dark-800"><X className="w-4 h-4" /></button>
            </div>
            <ol className="space-y-3 text-sm text-dark-400">
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-theme-accent/20 text-theme-accent text-xs font-bold flex items-center justify-center">1</span>
                <span>Tap the <Share className="inline w-4 h-4 text-blue-400" /> <strong className="text-dark-200">Share</strong> button in Safari's toolbar</span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-theme-accent/20 text-theme-accent text-xs font-bold flex items-center justify-center">2</span>
                <span>Scroll down and tap <strong className="text-dark-200">"Add to Home Screen"</strong></span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-theme-accent/20 text-theme-accent text-xs font-bold flex items-center justify-center">3</span>
                <span>Tap <strong className="text-dark-200">"Add"</strong> — BROMISE will appear on your Home Screen!</span>
              </li>
            </ol>
            <button onClick={() => setShowIOSHint(false)} className="mt-5 w-full py-2.5 rounded-xl bg-theme-accent text-white text-sm font-semibold hover:bg-theme-accent/90 transition-colors">Got it!</button>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-dark-900/95 backdrop-blur-lg border-t border-dark-800 px-2 py-2 flex items-center justify-around">
        {navItems.map(item => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`flex flex-col items-center py-1.5 px-3 rounded-xl transition-all ${
                isActive ? 'text-theme-accent bg-theme-accent/10' : 'text-dark-500 hover:text-theme-title'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
            </button>
          );
        })}
        {!isInstalled && (canInstall || isIOS) && (
          <button
            onClick={handleInstallClick}
            className="flex flex-col items-center py-1.5 px-3 rounded-xl transition-all text-theme-accent bg-theme-accent/10 animate-pulse"
            title="Install BROMISE App"
          >
            <Download className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium">Install</span>
          </button>
        )}
      </nav>
    </>
  );
};
