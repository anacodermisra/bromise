export type ThemeId = 'winter-arc' | 'dark-midnight' | 'cyberpunk' | 'emerald-forest' | 'sunset-amber';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  isDark: boolean;
  previewBg: string;
  previewAccent: string;
  description?: string;
  hasArtwork?: boolean;
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'winter-arc',
    name: 'Winter Arc (Frost & Discipline)',
    isDark: true,
    previewBg: '#05080c',
    previewAccent: '#38bdf8',
    description: 'Samurai on snowy peak with atmospheric falling snow',
    hasArtwork: true,
  },
  {
    id: 'dark-midnight',
    name: 'Midnight Command (Dark)',
    isDark: true,
    previewBg: '#090a0f',
    previewAccent: '#8b5cf6',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    isDark: true,
    previewBg: '#07050f',
    previewAccent: '#06b6d4',
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    isDark: true,
    previewBg: '#04100c',
    previewAccent: '#10b981',
  },
  {
    id: 'sunset-amber',
    name: 'Sunset Amber',
    isDark: true,
    previewBg: '#120c08',
    previewAccent: '#f59e0b',
  },
];

const THEME_KEY = 'antigravity_todo_theme';
const WINTER_ARC_SNOW_KEY = 'bromise_winter_arc_snow';
const WINTER_ARC_WALLPAPER_KEY = 'bromise_winter_arc_wallpaper';

export function getStoredTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_KEY) as ThemeId;
    if (saved === ('light-minimal' as any)) {
      localStorage.setItem(THEME_KEY, 'winter-arc');
      return 'winter-arc';
    }
    return saved && THEMES.some(t => t.id === saved) ? saved : 'winter-arc';
  } catch (e) {
    return 'winter-arc';
  }
}

export function applyTheme(themeId: ThemeId) {
  const activeId = THEMES.some(t => t.id === themeId) ? themeId : 'winter-arc';
  localStorage.setItem(THEME_KEY, activeId);
  const root = document.documentElement;

  // Set data-theme attribute for CSS variables
  root.setAttribute('data-theme', activeId);
  root.classList.add('dark');
  root.classList.remove('light');

  window.dispatchEvent(new CustomEvent('bromise-theme-change', { detail: activeId }));
}

export function isWinterArcSnowEnabled(): boolean {
  try {
    const val = localStorage.getItem(WINTER_ARC_SNOW_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setWinterArcSnowEnabled(enabled: boolean) {
  try {
    localStorage.setItem(WINTER_ARC_SNOW_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('bromise-winter-fx-change'));
  } catch {}
}

export function isWinterArcWallpaperEnabled(): boolean {
  try {
    const val = localStorage.getItem(WINTER_ARC_WALLPAPER_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function setWinterArcWallpaperEnabled(enabled: boolean) {
  try {
    localStorage.setItem(WINTER_ARC_WALLPAPER_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('bromise-winter-fx-change'));
  } catch {}
}
