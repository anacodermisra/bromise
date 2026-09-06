import React, { useState } from 'react';
import { exportDataJSON, importDataJSON } from '../../utils/storage';
import { resetToSeedData } from '../../utils/storage';
import { THEMES, getStoredTheme, applyTheme } from '../../utils/theme';
import type { ThemeId } from '../../utils/theme';
import { Download, Upload, RotateCcw, ShieldCheck, Check, Sparkles, Palette, Wifi, WifiOff } from 'lucide-react';

interface SettingsViewProps {
  onDataReset: () => void;
  onDataImported: () => void;
  serverOnline?: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onDataReset, onDataImported, serverOnline }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(getStoredTheme());
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleSelectTheme = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
  };

  const handleExport = () => {
    const jsonStr = exportDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bromise_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      const success = importDataJSON(content);
      if (success) {
        setImportStatus('Data imported successfully!');
        onDataImported();
      } else {
        setImportStatus('Failed to import — invalid or corrupted backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm('This will clear ALL tasks, categories, history, and plans. Start fresh with seed data?')) {
      resetToSeedData();
      onDataReset();
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-8 max-w-4xl mx-auto w-full">
      <div className="space-y-1">
        <div className="flex items-center space-x-2 text-xs font-semibold text-theme-accent uppercase tracking-widest">
          <Sparkles className="w-4 h-4" />
          <span>System Configuration & Appearance</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-theme-title font-sans">
          BROMISE Settings & Themes
        </h2>
        <p className="text-sm text-dark-500">
          Customize visual themes, manage data, and configure sync settings.
        </p>
      </div>

      {/* Server Sync Status */}
      <div className="p-4 rounded-2xl border border-dark-800 bg-dark-900 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
            serverOnline
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            {serverOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-sm font-bold text-theme-title">
              {serverOnline ? 'Server Connected' : 'Offline Mode'}
            </div>
            <div className="text-xs text-dark-500">
              {serverOnline
                ? 'Data is syncing with SQLite backend. Changes persist across devices.'
                : 'Using local storage. Changes will sync when server reconnects.'}
            </div>
          </div>
        </div>
        <div className={`w-2.5 h-2.5 rounded-full ${serverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
      </div>

      {/* Theme Selection */}
      <div className="p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-theme-accent-secondary/10 border border-theme-accent-secondary/20 text-theme-accent-secondary flex items-center justify-center">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-theme-title font-sans">Appearance & Color Themes</h3>
            <p className="text-xs text-dark-500">Select your preferred command center theme.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {THEMES.map(theme => {
            const isSelected = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => handleSelectTheme(theme.id)}
                className={`p-4 rounded-2xl border flex items-center space-x-3 transition-all duration-200 text-left ${
                  isSelected
                    ? 'bg-dark-850 border-theme-accent text-theme-title shadow-glow-accent ring-2 ring-theme-accent/40'
                    : 'bg-dark-950 border-dark-800 text-dark-400 hover:text-theme-title hover:border-dark-750'
                }`}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center border shadow-inner" style={{ backgroundColor: theme.previewBg }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.previewAccent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{theme.name}</div>
                  <div className="text-[10px] text-dark-500">Dark Mode</div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-theme-accent flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Management */}
      <div className="p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-5">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-theme-accent/10 border border-theme-accent/20 text-theme-accent flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-theme-title font-sans">Data Ownership & Backup</h3>
            <p className="text-xs text-dark-500">Export or restore your complete app data as a JSON backup.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-2xl bg-dark-950 border border-dark-800 space-y-3">
            <div className="text-xs font-bold text-theme-title">Export Full Backup</div>
            <p className="text-[11px] text-dark-500">
              Download all categories, tasks, daily plans, and completion history as JSON.
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
            <p className="text-[11px] text-dark-500">
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
          <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
            importStatus.includes('success')
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <Check className="w-4 h-4" />
            <span>{importStatus}</span>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="p-6 rounded-3xl bg-dark-900 border border-rose-500/20 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-theme-title font-sans">Reset Application</h3>
            <p className="text-xs text-dark-500">
              Clear all data and start fresh with default categories and tasks. This cannot be undone.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};
