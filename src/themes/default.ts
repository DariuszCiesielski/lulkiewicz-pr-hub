import type { Theme } from './types';

export const defaultTheme: Theme = {
  id: 'default',
  name: 'Klasyczny',
  description: 'Jasny motyw z niebieskimi akcentami',
  colors: {
    bgPrimary: '#f8fafc',
    bgSecondary: '#ffffff',
    bgTertiary: '#f1f5f9',
    bgAccent: '#e2e8f0',

    sidebarBg: '#0f172a',
    sidebarText: '#cbd5e1',
    sidebarHover: '#1e293b',
    sidebarActive: '#2563eb',

    headerBg: '#0f172a',
    headerGradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1e3a8a 100%)',
    headerText: '#ffffff',

    textPrimary: '#1e293b',
    textSecondary: '#475569',
    textMuted: '#64748b',
    textInverse: '#ffffff',

    borderPrimary: '#e2e8f0',
    borderSecondary: '#cbd5e1',
    borderAccent: '#3b82f6',

    accentPrimary: '#2563eb',
    accentHover: '#1d4ed8',
    accentLight: '#dbeafe',

    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fee2e2',
    info: '#3b82f6',
    infoLight: '#dbeafe',

    shadow: '0 1px 3px rgba(0,0,0,0.1)',
    shadowLg: '0 10px 15px -3px rgba(0,0,0,0.1)',
    overlay: 'rgba(15, 23, 42, 0.6)',

    scrollbarTrack: '#f1f1f1',
    scrollbarThumb: '#cbd5e1',
    scrollbarThumbHover: '#94a3b8',
  },
};
