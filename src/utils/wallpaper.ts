import type { WallpaperConfig } from '../types';

export interface WallpaperPreset {
  id: string;
  name: string;
  category: 'gym' | 'study' | 'general';
  description: string;
  previewUrl: string;
  defaultDim: number;
}

function svgToDataUrl(rawSvg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(rawSvg.trim())}`;
}

// Built-in high-performance SVG backdrops for zero-network reliability
export const DARK_GYM_WALLPAPER = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <radialGradient id="gymGlow" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#0f1f33" stop-opacity="0.95" />
      <stop offset="50%" stop-color="#060b13" stop-opacity="0.98" />
      <stop offset="100%" stop-color="#010305" stop-opacity="1" />
    </radialGradient>
    <linearGradient id="neonLight" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f0ff" stop-opacity="0" />
      <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#00f0ff" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="silverSheen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.1" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
    <pattern id="gymGrid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e2c3f" stroke-width="0.8" opacity="0.35" />
    </pattern>
  </defs>
  <rect width="1920" height="1080" fill="url(#gymGlow)" />
  <rect width="1920" height="1080" fill="url(#gymGrid)" />
  <!-- Overhead Fluorescent Track -->
  <rect x="220" y="60" width="1480" height="4" fill="url(#neonLight)" />
  <circle cx="960" cy="62" r="240" fill="#38bdf8" opacity="0.08" filter="blur(60px)" />
  <rect width="1920" height="350" fill="url(#silverSheen)" />
  <!-- Heavy Iron Barbells & Plates Silhouette Grid -->
  <g opacity="0.22" fill="#64748b">
    <rect x="180" y="820" width="1560" height="28" rx="14" fill="#334155" />
    <!-- Barbell Plate Silhouettes Left -->
    <circle cx="420" cy="834" r="150" fill="#1e293b" stroke="#475569" stroke-width="5" />
    <circle cx="420" cy="834" r="100" fill="none" stroke="#64748b" stroke-width="3" />
    <circle cx="420" cy="834" r="30" fill="#0f172a" />
    <!-- Barbell Plate Silhouettes Right -->
    <circle cx="1500" cy="834" r="150" fill="#1e293b" stroke="#475569" stroke-width="5" />
    <circle cx="1500" cy="834" r="100" fill="none" stroke="#64748b" stroke-width="3" />
    <circle cx="1500" cy="834" r="30" fill="#0f172a" />
    <!-- Center Pro Dumbbell Silhouette -->
    <rect x="910" y="818" width="100" height="18" rx="9" fill="#94a3b8" />
    <rect x="875" y="776" width="35" height="102" rx="8" fill="#475569" />
    <rect x="1010" y="776" width="35" height="102" rx="8" fill="#475569" />
  </g>
</svg>`);

export const DARK_LIBRARY_WALLPAPER = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <radialGradient id="libGlow" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1c140d" stop-opacity="0.95" />
      <stop offset="55%" stop-color="#0e0804" stop-opacity="0.98" />
      <stop offset="100%" stop-color="#040201" stop-opacity="1" />
    </radialGradient>
    <linearGradient id="amberLamp" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#libGlow)" />
  <!-- Warm Amber Desk Lamp Glow -->
  <polygon points="960,80 600,820 1320,820" fill="url(#amberLamp)" filter="blur(40px)" />
  <!-- Deep Timber Bookshelves Outline -->
  <g opacity="0.16" stroke="#d97706" stroke-width="2" fill="none">
    <line x1="120" y1="280" x2="1800" y2="280" />
    <line x1="120" y1="520" x2="1800" y2="520" />
    <line x1="120" y1="760" x2="1800" y2="760" />
    <!-- Book silhouettes on shelves -->
    <path d="M 200 280 L 200 170 L 235 170 L 235 280 Z M 240 280 L 240 160 L 280 160 L 280 280 Z M 290 280 L 315 180 L 340 185 L 320 280 Z" fill="#b45309" opacity="0.5" />
    <path d="M 1580 280 L 1580 165 L 1625 165 L 1625 280 Z M 1630 280 L 1630 180 L 1675 180 L 1675 280 Z" fill="#b45309" opacity="0.5" />
  </g>
</svg>`);

export const CYBERPUNK_WALLPAPER = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <radialGradient id="cyberGlow" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#160824" stop-opacity="1" />
      <stop offset="60%" stop-color="#0a0312" stop-opacity="1" />
      <stop offset="100%" stop-color="#020005" stop-opacity="1" />
    </radialGradient>
    <linearGradient id="neonCyan" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="neonPink" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#ec4899" stop-opacity="0" />
    </linearGradient>
    <pattern id="cyberGrid" width="80" height="80" patternUnits="userSpaceOnUse">
      <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#a855f7" stroke-width="0.8" opacity="0.15" />
    </pattern>
  </defs>
  <rect width="1920" height="1080" fill="url(#cyberGlow)" />
  <rect width="1920" height="1080" fill="url(#cyberGrid)" />
  <!-- Neon Horizon Glows -->
  <circle cx="480" cy="720" r="300" fill="url(#neonPink)" filter="blur(80px)" />
  <circle cx="1440" cy="720" r="300" fill="url(#neonCyan)" filter="blur(80px)" />
  <!-- Distant Skyline Silhouette -->
  <polygon points="200,900 200,680 280,680 280,720 340,720 340,650 420,650 420,900" fill="#130b20" opacity="0.5" />
  <polygon points="1500,900 1500,640 1580,640 1580,700 1660,700 1660,900" fill="#130b20" opacity="0.5" />
</svg>`);

export const DEEP_COSMOS_WALLPAPER = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <radialGradient id="cosmosGlow" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#140f2b" stop-opacity="1" />
      <stop offset="50%" stop-color="#080714" stop-opacity="1" />
      <stop offset="100%" stop-color="#020108" stop-opacity="1" />
    </radialGradient>
    <radialGradient id="nebulaPurple" cx="35%" cy="35%" r="40%">
      <stop offset="0%" stop-color="#8b5cf6" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="nebulaBlue" cx="65%" cy="45%" r="40%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#cosmosGlow)" />
  <circle cx="600" cy="400" r="450" fill="url(#nebulaPurple)" filter="blur(90px)" />
  <circle cx="1300" cy="500" r="450" fill="url(#nebulaBlue)" filter="blur(90px)" />
  <!-- Starlight Clusters -->
  <g fill="#ffffff" opacity="0.6">
    <circle cx="320" cy="210" r="1.5" />
    <circle cx="480" cy="140" r="1" />
    <circle cx="780" cy="280" r="2" />
    <circle cx="950" cy="180" r="1.2" />
    <circle cx="1180" cy="240" r="1.8" />
    <circle cx="1450" cy="150" r="1.5" />
    <circle cx="1680" cy="290" r="2.2" />
    <circle cx="850" cy="650" r="1.3" />
    <circle cx="1320" cy="720" r="1.6" />
  </g>
</svg>`);

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'winter-arc',
    name: 'Winter Arc Peak',
    category: 'general',
    description: 'Lone samurai overlooking snowy peaks in high-focus discipline',
    previewUrl: '/winter-arc-bg.jpg',
    defaultDim: 0.45,
  },
  {
    id: 'dark-gym',
    name: 'The Iron Den (Gym)',
    category: 'gym',
    description: 'Sleek dark metallic iron gym with cyan electric backlight',
    previewUrl: DARK_GYM_WALLPAPER,
    defaultDim: 0.35,
  },
  {
    id: 'dark-library',
    name: 'The Grand Library (Study)',
    category: 'study',
    description: 'Dark academia study room with books, deep timber & warm ambient glow',
    previewUrl: DARK_LIBRARY_WALLPAPER,
    defaultDim: 0.35,
  },
  {
    id: 'cyberpunk-skyline',
    name: 'Cyberpunk Skyline',
    category: 'general',
    description: 'Futuristic dark neon cityscape with synthwave glow',
    previewUrl: CYBERPUNK_WALLPAPER,
    defaultDim: 0.40,
  },
  {
    id: 'deep-cosmos',
    name: 'Deep Cosmos Nebula',
    category: 'general',
    description: 'Starlight clusters and interstellar indigo dust',
    previewUrl: DEEP_COSMOS_WALLPAPER,
    defaultDim: 0.40,
  },
];

const WALLPAPER_CONFIG_KEY = 'bromise_wallpaper_config';

export function getStoredWallpaperConfig(): WallpaperConfig {
  try {
    const raw = localStorage.getItem(WALLPAPER_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          enabled: parsed.enabled ?? true,
          type: parsed.type || 'preset',
          presetId: parsed.presetId || 'winter-arc',
          customUrl: parsed.customUrl,
          dimOpacity: parsed.dimOpacity ?? 0.45,
          blurPx: parsed.blurPx ?? 0,
          roomWallpapers: {
            gym: DARK_GYM_WALLPAPER,
            study: DARK_LIBRARY_WALLPAPER,
          },
        };
      }
    }
  } catch {}
  return {
    enabled: true,
    type: 'preset',
    presetId: 'winter-arc',
    dimOpacity: 0.45,
    blurPx: 0,
    roomWallpapers: {
      gym: DARK_GYM_WALLPAPER,
      study: DARK_LIBRARY_WALLPAPER,
    },
  };
}

export function saveWallpaperConfig(config: WallpaperConfig) {
  try {
    localStorage.setItem(WALLPAPER_CONFIG_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('bromise-wallpaper-change', { detail: config }));
  } catch (e) {
    console.error('Failed to save wallpaper config:', e);
  }
}

export function getActiveWallpaperUrl(config: WallpaperConfig, currentView?: string): string | null {
  // Gym Room ALWAYS has its own dedicated Iron Den wallpaper regardless of general settings
  if (currentView === 'gym') {
    return DARK_GYM_WALLPAPER;
  }

  // Study Room ALWAYS has its own dedicated Grand Library wallpaper throughout
  if (currentView === 'study') {
    return DARK_LIBRARY_WALLPAPER;
  }

  // General Views: Check if enabled
  if (!config.enabled) return null;

  if (config.type === 'custom' && config.customUrl) {
    return config.customUrl;
  }

  const preset = WALLPAPER_PRESETS.find(p => p.id === config.presetId);
  return preset ? preset.previewUrl : '/winter-arc-bg.jpg';
}
