import type { Theme } from './types';

export const darkTheme: Theme = {
  id: 'dark',
  name: 'Ciemny',
  description: 'Elegancki ciemny motyw',
  colors: {
    bgPrimary: '#0f172a',
    bgSecondary: '#1e293b',
    bgTertiary: '#334155',
    bgAccent: '#475569',

    sidebarBg: '#020617',
    sidebarText: '#94a3b8',
    sidebarHover: '#1e293b',
    sidebarActive: '#3b82f6',

    headerBg: '#020617',
    headerGradient: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #172554 100%)',
    headerText: '#f1f5f9',

    textPrimary: '#f1f5f9',
    textSecondary: '#cbd5e1',
    textMuted: '#64748b',
    textInverse: '#0f172a',

    borderPrimary: '#334155',
    borderSecondary: '#475569',
    borderAccent: '#60a5fa',

    accentPrimary: '#3b82f6',
    accentHover: '#60a5fa',
    accentLight: '#1e3a8a',

    success: '#34d399',
    successLight: '#064e3b',
    warning: '#fbbf24',
    warningLight: '#78350f',
    error: '#f87171',
    errorLight: '#7f1d1d',
    info: '#60a5fa',
    infoLight: '#1e3a8a',

    shadow: '0 4px 12px rgba(0,0,0,0.4)',
    shadowLg: '0 20px 25px -5px rgba(0,0,0,0.5)',
    overlay: 'rgba(0, 0, 0, 0.7)',

    scrollbarTrack: '#1e293b',
    scrollbarThumb: '#475569',
    scrollbarThumbHover: '#64748b',
  },
};
