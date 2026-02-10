import type { Theme } from './types';

export const minimalTheme: Theme = {
  id: 'minimal',
  name: 'Minimalistyczny',
  description: 'Czysty, minimalistyczny design',
  colors: {
    bgPrimary: '#fafafa',
    bgSecondary: '#ffffff',
    bgTertiary: '#f5f5f5',
    bgAccent: '#e5e5e5',

    sidebarBg: '#171717',
    sidebarText: '#a3a3a3',
    sidebarHover: '#262626',
    sidebarActive: '#525252',

    headerBg: '#171717',
    headerGradient: 'linear-gradient(135deg, #171717 0%, #262626 100%)',
    headerText: '#fafafa',

    textPrimary: '#171717',
    textSecondary: '#525252',
    textMuted: '#a3a3a3',
    textInverse: '#fafafa',

    borderPrimary: '#e5e5e5',
    borderSecondary: '#d4d4d4',
    borderAccent: '#525252',

    accentPrimary: '#171717',
    accentHover: '#262626',
    accentLight: '#f5f5f5',

    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    error: '#ef4444',
    errorLight: '#fee2e2',
    info: '#3b82f6',
    infoLight: '#dbeafe',

    shadow: '0 1px 2px rgba(0,0,0,0.05)',
    shadowLg: '0 4px 6px -1px rgba(0,0,0,0.1)',
    overlay: 'rgba(23, 23, 23, 0.5)',

    scrollbarTrack: '#f5f5f5',
    scrollbarThumb: '#d4d4d4',
    scrollbarThumbHover: '#a3a3a3',
  },
};
