/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  safelist: [
    { pattern: /^(bg|text|border|ring|from|to|via|shadow)-(theme-accent|theme-accent-secondary|theme-title|theme-body|theme-sub|theme-bg|theme-card)/ },
    { pattern: /^(bg|text|border|ring|from|to|via)-(theme-accent|theme-accent-secondary)\/[0-9]+/ },
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: 'rgb(var(--app-bg) / <alpha-value>)',
          card: 'rgb(var(--card-bg) / <alpha-value>)',
          hover: 'rgb(var(--hover-bg) / <alpha-value>)',
          border: 'rgb(var(--border-color) / <alpha-value>)',
          strong: 'rgb(var(--border-strong) / <alpha-value>)',
          title: 'rgb(var(--text-title) / <alpha-value>)',
          body: 'rgb(var(--text-body) / <alpha-value>)',
          sub: 'rgb(var(--text-sub) / <alpha-value>)',
          accent: 'rgb(var(--accent-primary) / <alpha-value>)',
          'accent-secondary': 'rgb(var(--accent-secondary) / <alpha-value>)',
        },
        dark: {
          950: 'rgb(var(--app-bg) / <alpha-value>)',
          900: 'rgb(var(--card-bg) / <alpha-value>)',
          850: 'rgb(var(--hover-bg) / <alpha-value>)',
          800: 'rgb(var(--border-color) / <alpha-value>)',
          750: 'rgb(var(--border-strong) / <alpha-value>)',
          700: 'rgb(var(--border-strong) / <alpha-value>)',
          600: 'rgb(var(--text-sub) / <alpha-value>)',
          500: 'rgb(var(--text-sub) / <alpha-value>)',
          400: 'rgb(var(--text-sub) / <alpha-value>)',
          300: 'rgb(var(--text-body) / <alpha-value>)',
          200: 'rgb(var(--text-body) / <alpha-value>)',
          100: 'rgb(var(--text-body) / <alpha-value>)',
          50: 'rgb(var(--text-title) / <alpha-value>)',
        },
        accent: {
          purple: '#8b5cf6',
          blue: '#3b82f6',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          cyan: '#06b6d4',
          violet: '#7c3aed',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-accent': '0 0 20px -5px rgb(var(--accent-primary) / 0.4)',
        'glow-purple': '0 0 20px -5px rgba(139, 92, 246, 0.3)',
        'glow-emerald': '0 0 20px -5px rgba(16, 185, 129, 0.3)',
        'glow-blue': '0 0 20px -5px rgba(59, 130, 246, 0.3)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }
    },
  },
  plugins: [],
}
