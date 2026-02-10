import type { Theme } from './types';

export const corporateTheme: Theme = {
  id: 'corporate',
  name: 'Korporacyjny',
  description: 'Profesjonalny motyw biznesowy',
  colors: {
    bgPrimary: '#f8fafc',
    bgSecondary: '#ffffff',
    bgTertiary: '#f1f5f9',
    bgAccent: '#e2e8f0',

    sidebarBg: '#1e293b',
    sidebarText: '#94a3b8',
    sidebarHover: '#334155',
    sidebarActive: '#0284c7',

    headerBg: '#1e293b',
    headerGradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #0c4a6e 100%)',
    headerText: '#f8fafc',

    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    textInverse: '#f8fafc',

    borderPrimary: '#e2e8f0',
    borderSecondary: '#cbd5e1',
    borderAccent: '#0284c7',

    accentPrimary: '#0284c7',
    accentHover: '#0369a1',
    accentLight: '#e0f2fe',

    success: '#059669',
    successLight: '#d1fae5',
    warning: '#d97706',
    warningLight: '#fef3c7',
    error: '#dc2626',
    errorLight: '#fee2e2',
    info: '#0284c7',
    infoLight: '#e0f2fe',

    shadow: '0 1px 3px rgba(0,0,0,0.08)',
    shadowLg: '0 10px 15px -3px rgba(0,0,0,0.08)',
    overlay: 'rgba(15, 23, 42, 0.5)',

    scrollbarTrack: '#f1f5f9',
    scrollbarThumb: '#cbd5e1',
    scrollbarThumbHover: '#94a3b8',
  },
};
