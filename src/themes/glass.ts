import type { Theme } from './types';

export const glassTheme: Theme = {
  id: 'glass',
  name: 'Szkło',
  description: 'Nowoczesny efekt glassmorphism',
  colors: {
    bgPrimary: '#0f172a',
    bgSecondary: 'rgba(30, 41, 59, 0.8)',
    bgTertiary: 'rgba(51, 65, 85, 0.6)',
    bgAccent: 'rgba(71, 85, 105, 0.5)',

    sidebarBg: 'rgba(2, 6, 23, 0.9)',
    sidebarText: '#94a3b8',
    sidebarHover: 'rgba(30, 41, 59, 0.8)',
    sidebarActive: '#3b82f6',

    headerBg: 'rgba(2, 6, 23, 0.8)',
    headerGradient: 'linear-gradient(135deg, rgba(2,6,23,0.9) 0%, rgba(15,23,42,0.8) 50%, rgba(23,37,84,0.9) 100%)',
    headerText: '#f1f5f9',

    textPrimary: '#f1f5f9',
    textSecondary: '#cbd5e1',
    textMuted: '#64748b',
    textInverse: '#0f172a',

    borderPrimary: 'rgba(148, 163, 184, 0.2)',
    borderSecondary: 'rgba(148, 163, 184, 0.3)',
    borderAccent: '#60a5fa',

    accentPrimary: '#3b82f6',
    accentHover: '#60a5fa',
    accentLight: 'rgba(59, 130, 246, 0.2)',

    success: '#34d399',
    successLight: 'rgba(52, 211, 153, 0.2)',
    warning: '#fbbf24',
    warningLight: 'rgba(251, 191, 36, 0.2)',
    error: '#f87171',
    errorLight: 'rgba(248, 113, 113, 0.2)',
    info: '#60a5fa',
    infoLight: 'rgba(96, 165, 250, 0.2)',

    shadow: '0 8px 32px rgba(0,0,0,0.3)',
    shadowLg: '0 25px 50px -12px rgba(0,0,0,0.5)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    glassBg: 'rgba(255, 255, 255, 0.05)',
    blur: '12px',

    scrollbarTrack: 'rgba(30, 41, 59, 0.5)',
    scrollbarThumb: 'rgba(100, 116, 139, 0.5)',
    scrollbarThumbHover: 'rgba(148, 163, 184, 0.5)',
  },
  effects: {
    glassmorphism: true,
    backdropBlur: true,
  },
};
