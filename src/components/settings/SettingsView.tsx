import React, { useState } from 'react';
import {
  exportDataJSON,
  importDataJSON,
  resetToSeedData,
  cleanPrefilledTasks,
} from '../../utils/storage';
import {
  THEMES,
  getStoredTheme,
  applyTheme,
  isWinterArcSnowEnabled,
  setWinterArcSnowEnabled,
  isWinterArcWallpaperEnabled,
  setWinterArcWallpaperEnabled,
} from '../../utils/theme';
import type { ThemeId } from '../../utils/theme';
import {
  getStoredWallpaperConfig,
  saveWallpaperConfig,
} from '../../utils/wallpaper';
import {
  getStoredAIConfig,
  saveStoredAIConfig,
  testLocalAIConnection,
  getActiveAIModelInfo,
} from '../../services/aiService';
import type { WallpaperConfig, AIConfig } from '../../types';
import {
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Check,
  Palette,
  Wifi,
  WifiOff,
  LogOut,
  User as UserIcon,
  Snowflake,
  Trash2,
  RefreshCw,
  Info,
  Key,
  ExternalLink,
  Bot,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { APP_VERSION, APP_RELEASE_NAME } from '../../config/version';

interface SettingsViewProps {
  onDataReset: () => void;
  onDataImported: () => void;
  serverOnline?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onDataReset,
  onDataImported,
  serverOnline,
}) => {
  const { user, logout } = useAuth();
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(getStoredTheme());
  const [winterSnow, setWinterSnow] = useState(isWinterArcSnowEnabled());
  const [winterWallpaper, setWinterWallpaper] = useState(isWinterArcWallpaperEnabled());
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Atmosphere dimming settings
  const [wallpaperConfig, setWallpaperConfig] = useState<WallpaperConfig>(getStoredWallpaperConfig());

  // Bro Bot assistant settings state
  const [aiConfig, setAiConfig] = useState<AIConfig>(getStoredAIConfig());
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Purge sample tasks feedback
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);

  const modelInfo = getActiveAIModelInfo(aiConfig);

  const handleSelectTheme = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
  };

  const handleToggleSnow = () => {
    const next = !winterSnow;
    setWinterSnow(next);
    setWinterArcSnowEnabled(next);
  };

  const handleToggleWallpaper = () => {
    const next = !winterWallpaper;
    setWinterWallpaper(next);
    setWinterArcWallpaperEnabled(next);
  };

  const handleUpdateWallpaper = (partial: Partial<WallpaperConfig>) => {
    setWallpaperConfig(prev => {
      const updated = { ...prev, ...partial };
      saveWallpaperConfig(updated);
      return updated;
    });
  };

  const handleUpdateAI = (partial: Partial<AIConfig>) => {
    setAiConfig(prev => {
      const updated = { ...prev, ...partial };
      saveStoredAIConfig(updated);
      return updated;
    });
  };

  const handleTestAI = async () => {
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const res = await testLocalAIConnection(aiConfig);
      setAiTestResult(res);
      if (res.ok) {
        saveStoredAIConfig(aiConfig);
      }
    } catch (e: any) {
      setAiTestResult({ ok: false, message: e.message });
    } finally {
      setAiTesting(false);
    }
  };

  const handlePurgeSampleTasks = () => {
    const count = cleanPrefilledTasks();
    if (count > 0) {
      setPurgeStatus(`Successfully purged ${count} sample prefilled tasks! Your backlog is now clean.`);
      onDataImported();
    } else {
      setPurgeStatus('All sample tasks have already been cleared. Running clean!');
    }
    setTimeout(() => setPurgeStatus(null), 4000);
  };

  const handleExport = () => {
    const jsonStr = exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bromise-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataJSON(content);
        if (success) {
          setImportStatus('Data successfully imported!');
          onDataImported();
        } else {
          setImportStatus('Failed to import data. Please check JSON file format.');
        }
        setTimeout(() => setImportStatus(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleReset = () => {
    if (
      confirm(
        'WARNING: This will wipe your database and reset to clean factory defaults. Continue?'
      )
    ) {
      resetToSeedData();
      onDataReset();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-fade-in font-sans">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-theme-title font-sans">Settings & Preferences</h2>
        <p className="text-xs text-dark-400 mt-1">
          Customize themes, Winter mood atmosphere, Bro Bot intelligence, and manage your data.
        </p>
      </div>

      {/* Account Info */}
      {user && (
        <div className="p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5 min-w-0">
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-12 h-12 rounded-2xl object-cover border border-theme-accent/40 shadow-glow-accent flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-theme-accent/20 text-theme-accent flex items-center justify-center font-bold text-lg flex-shrink-0 border border-theme-accent/30">
                  {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-6 h-6" />}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-base font-bold text-theme-title truncate">{user.name}</div>
                <div className="text-xs text-dark-400 truncate">{user.email}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-theme-accent/10 text-theme-accent border border-theme-accent/20">
                    {user.email.includes('@') && !user.id.startsWith('usr-mock') ? 'Google Connected' : 'Demo Account'}
                  </span>
                  <span className="text-[10px] text-dark-500 font-mono">
                    ID: {user.id.substring(0, 10)}...
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all self-start sm:self-center"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Server Sync Status & Version */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl border border-dark-800 bg-dark-900 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                serverOnline
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}
            >
              {serverOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </div>
            <div>
              <div className="text-sm font-bold text-theme-title">
                {serverOnline ? 'Backend Synced' : 'Offline Mode'}
              </div>
              <div className="text-xs text-dark-400">
                {serverOnline ? 'SQLite persistent storage connected.' : 'Local browser storage active.'}
              </div>
            </div>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full ${serverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
        </div>

        <div className="p-4 rounded-2xl border border-dark-800 bg-dark-900 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-theme-accent/30 bg-theme-accent/10 text-theme-accent">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-theme-title">BROMISE</span>
                <span className="px-2 py-0.5 rounded-full bg-theme-accent/20 text-theme-accent text-[11px] font-mono font-bold border border-theme-accent/30">
                  v{APP_VERSION}
                </span>
              </div>
              <div className="text-xs text-dark-400">
                {APP_RELEASE_NAME} · High Performance Daily Engine
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Winter Mood Atmosphere Controls */}
      <div className="p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Snowflake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-theme-title font-sans">Winter Mood Atmosphere</h3>
              <p className="text-xs text-dark-400">
                Individual controls for the iconic Winter Arc Samurai artwork and dynamic snow.
              </p>
            </div>
          </div>
        </div>

        {/* Individual Toggles: Samurai Artwork & Dynamic Snow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Samurai Artwork Toggle */}
          <div className="p-4 rounded-2xl bg-dark-950 border border-dark-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-theme-title block">Samurai Artwork Wallpaper</span>
              <span className="text-[11px] text-dark-400">
                High-contrast winter samurai artwork on dashboard and tracker.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleWallpaper}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                winterWallpaper
                  ? 'bg-theme-accent/20 border-theme-accent/40 text-theme-accent'
                  : 'bg-dark-900 border-dark-800 text-dark-500'
              }`}
            >
              {winterWallpaper ? 'ACTIVE' : 'OFF'}
            </button>
          </div>

          {/* Dynamic Falling Snow Toggle */}
          <div className="p-4 rounded-2xl bg-dark-950 border border-dark-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-theme-title block">Dynamic Falling Snow</span>
              <span className="text-[11px] text-dark-400">
                Lightweight real-time snowfall particles across the interface.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleSnow}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                winterSnow
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-dark-900 border-dark-800 text-dark-500'
              }`}
            >
              {winterSnow ? 'ACTIVE' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Atmosphere Dimming Control Slider */}
        <div className="p-4 rounded-2xl bg-dark-950 border border-dark-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-dark-300 flex items-center space-x-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-theme-accent" />
              <span>Background Readability Dimming</span>
            </span>
            <span className="font-mono font-bold text-theme-accent">
              {Math.round(wallpaperConfig.dimOpacity * 100)}% Dark Scrim
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="0.95"
            step="0.05"
            value={wallpaperConfig.dimOpacity}
            onChange={e => handleUpdateWallpaper({ dimOpacity: parseFloat(e.target.value) })}
            className="w-full accent-theme-accent cursor-pointer h-1.5 bg-dark-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-dark-500 font-mono">
            <span>50% (More visible artwork)</span>
            <span>85% (Optimal text contrast)</span>
            <span>95% (Near black background)</span>
          </div>
        </div>
      </div>

      {/* Appearance & Color Themes */}
      <div className="p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-theme-accent/10 border border-theme-accent/20 text-theme-accent flex items-center justify-center">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-theme-title font-sans">Accent Themes</h3>
            <p className="text-xs text-dark-400">Select your preferred accent colors and UI highlights.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {THEMES.map(theme => {
            const isSelected = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleSelectTheme(theme.id)}
                className={`p-3 rounded-2xl border flex items-center space-x-3 text-left transition-all ${
                  isSelected
                    ? 'border-theme-accent bg-dark-850 ring-2 ring-theme-accent/30 shadow-glow-accent'
                    : 'border-dark-800 bg-dark-950 hover:border-dark-700'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 border border-white/20"
                  style={{ backgroundColor: theme.previewAccent }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-theme-title truncate">{theme.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bro Bot Engine Settings */}
      <div className="p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-theme-title font-sans">Bro Bot Intelligence Engine</h3>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    modelInfo.isCloud
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  }`}
                >
                  {modelInfo.modelName}
                </span>
              </div>
              <p className="text-xs text-dark-400">{modelInfo.statusText}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-1">
          {/* Provider Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                id: 'gemini',
                title: 'Google Gemini',
                subtitle: 'Cloud LLM for phone & desktop (Recommended)',
              },
              {
                id: 'ollama',
                title: 'Ollama',
                subtitle: 'Local laptop LLM on port 11434',
              },
              {
                id: 'lmstudio',
                title: 'LM Studio',
                subtitle: 'Local server on port 1234',
              },
              {
                id: 'offline',
                title: 'Offline NLP',
                subtitle: 'Built-in fast rule parser',
              },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleUpdateAI({ provider: p.id as any })}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  aiConfig.provider === p.id
                    ? 'border-theme-accent bg-dark-850 ring-2 ring-theme-accent/30 text-theme-title'
                    : 'border-dark-800 bg-dark-950 text-dark-400 hover:border-dark-700'
                }`}
              >
                <div className="text-xs font-bold">{p.title}</div>
                <div className="text-[10px] text-dark-400 mt-0.5 leading-snug">{p.subtitle}</div>
              </button>
            ))}
          </div>

          {/* Gemini API Key Box */}
          {aiConfig.provider === 'gemini' && (
            <div className="p-4 rounded-2xl bg-dark-950 border border-theme-accent/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-theme-accent flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5" />
                  <span>Google Gemini API Key</span>
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-theme-accent hover:underline flex items-center space-x-1"
                >
                  <span>Get Free Key (Google AI Studio)</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              <input
                type="password"
                value={aiConfig.apiKey || ''}
                onChange={e => handleUpdateAI({ apiKey: e.target.value })}
                placeholder="Paste Gemini API Key (AIzaSy...)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-900 border border-dark-800 text-xs text-white font-mono focus:outline-none focus:border-theme-accent"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-dark-300 block mb-1">
                    Gemini Model
                  </label>
                  <select
                    value={aiConfig.geminiModel || 'gemini-3.5-flash'}
                    onChange={e => handleUpdateAI({ geminiModel: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-dark-900 border border-dark-800 text-xs text-white"
                  >
                    <option value="gemini-3.5-flash">gemini-3.5-flash (High Speed, Free Tier Recommended)</option>
                    <option value="gemini-3.6-flash">gemini-3.6-flash (Advanced Reasoning Flash)</option>
                    <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Ultra Fast & Lightweight)</option>
                  </select>
                </div>

                <div className="text-[10px] text-dark-400 flex items-center">
                  Free tier keys work with zero cost. With this key, Bro Bot can reason about tasks and schedule them directly on any device!
                </div>
              </div>
            </div>
          )}

          {/* Ollama / LM Studio endpoint inputs */}
          {(aiConfig.provider === 'ollama' || aiConfig.provider === 'lmstudio') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-dark-400">Endpoint URL</label>
                <input
                  type="text"
                  value={aiConfig.endpointUrl}
                  onChange={e => handleUpdateAI({ endpointUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-dark-800 text-xs text-theme-title font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-dark-400">Model Name</label>
                <input
                  type="text"
                  value={aiConfig.model}
                  onChange={e => handleUpdateAI({ model: e.target.value })}
                  placeholder="llama3.2"
                  className="w-full px-3 py-2 rounded-xl bg-dark-950 border border-dark-800 text-xs text-theme-title font-mono"
                />
              </div>
            </div>
          )}

          {/* Test Link Button */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-dark-400">
              {aiConfig.provider === 'gemini'
                ? 'Validates API key with Google servers.'
                : 'Pings local engine endpoint.'}
            </span>

            <button
              type="button"
              onClick={handleTestAI}
              disabled={aiTesting}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-theme-title text-xs font-bold border border-dark-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${aiTesting ? 'animate-spin text-theme-accent' : ''}`} />
              <span>{aiTesting ? 'Testing Link...' : 'Test Connection'}</span>
            </button>
          </div>

          {aiTestResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                aiTestResult.ok
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}
            >
              {aiTestResult.ok ? <Check className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span>{aiTestResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Data Management & Clean-up */}
      <div className="p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-theme-accent/10 border border-theme-accent/20 text-theme-accent flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-theme-title font-sans">Data Management</h3>
            <p className="text-xs text-dark-400">Purge sample tasks, export JSON backups, or restore backups.</p>
          </div>
        </div>

        {/* Purge Sample Tasks Highlight Tool */}
        <div className="p-4 rounded-2xl bg-dark-950 border border-theme-accent/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold text-theme-title flex items-center space-x-2">
              <Trash2 className="w-3.5 h-3.5 text-theme-accent" />
              <span>Purge Sample & Prefilled Tasks</span>
            </div>
            <p className="text-[11px] text-dark-400 max-w-lg">
              One-click cleanup: deletes initial example tasks without touching your custom categories or custom tasks!
            </p>
          </div>
          <button
            type="button"
            onClick={handlePurgeSampleTasks}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-theme-accent/15 hover:bg-theme-accent/25 text-theme-accent border border-theme-accent/30 text-xs font-bold transition-all shadow-glow-accent whitespace-nowrap self-start sm:self-center"
          >
            <Trash2 className="w-4 h-4" />
            <span>Purge Sample Tasks</span>
          </button>
        </div>

        {purgeStatus && (
          <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center space-x-2">
            <Check className="w-4 h-4" />
            <span>{purgeStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="p-4 rounded-2xl bg-dark-950 border border-dark-800 space-y-3">
            <div className="text-xs font-bold text-theme-title">Export Full Backup</div>
            <p className="text-[11px] text-dark-400">
              Download all categories, tasks, daily plans, gym schedules, and completion history as JSON.
            </p>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-theme-accent hover:bg-theme-accent/90 text-white text-xs font-bold shadow-glow-accent transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Export JSON Backup</span>
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-dark-950 border border-dark-800 space-y-3">
            <div className="text-xs font-bold text-theme-title">Import Backup</div>
            <p className="text-[11px] text-dark-400">
              Restore your complete application state from a previously exported file.
            </p>
            <label className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-theme-title text-xs font-bold border border-dark-700 cursor-pointer transition-all">
              <Upload className="w-4 h-4 text-theme-accent" />
              <span>Select Backup File</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>
        </div>

        {importStatus && (
          <div
            className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
              importStatus.includes('success')
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>{importStatus}</span>
          </div>
        )}
      </div>

      {/* Danger Zone: Full Factory Reset */}
      <div className="p-6 rounded-3xl bg-dark-900 border border-rose-500/20 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-theme-title font-sans">Full Factory Reset</h3>
            <p className="text-xs text-dark-400">
              Wipe all database records and start fresh from scratch.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset All Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
