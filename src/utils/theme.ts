export type ThemeId = 'dark-midnight' | 'cyberpunk' | 'emerald-forest' | 'sunset-amber';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  isDark: boolean;
  previewBg: string;
  previewAccent: string;
}

export const THEMES: ThemeConfig[] = [
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

export function getStoredTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(THEME_KEY) as ThemeId;
    if (saved === ('light-minimal' as any)) {
      localStorage.setItem(THEME_KEY, 'dark-midnight');
      return 'dark-midnight';
    }
    return saved && THEMES.some(t => t.id === saved) ? saved : 'dark-midnight';
  } catch (e) {
    return 'dark-midnight';
  }
}

export function applyTheme(themeId: ThemeId) {
  const activeId = THEMES.some(t => t.id === themeId) ? themeId : 'dark-midnight';
  localStorage.setItem(THEME_KEY, activeId);
  const root = document.documentElement;

  // Set data-theme attribute for CSS variables
  root.setAttribute('data-theme', activeId);
  root.classList.add('dark');
  root.classList.remove('light');
}
