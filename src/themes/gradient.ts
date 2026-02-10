import type { Theme } from './types';

export const gradientTheme: Theme = {
  id: 'gradient',
  name: 'Gradientowy',
  description: 'Żywe gradienty z fioletowym akcentem',
  colors: {
    bgPrimary: '#0c0a1a',
    bgSecondary: 'rgba(20, 15, 45, 0.9)',
    bgTertiary: 'rgba(35, 25, 65, 0.7)',
    bgAccent: 'rgba(55, 40, 90, 0.6)',

    sidebarBg: 'rgba(8, 5, 18, 0.95)',
    sidebarText: '#a78bfa',
    sidebarHover: 'rgba(35, 25, 65, 0.8)',
    sidebarActive: '#8b5cf6',

    headerBg: 'rgba(8, 5, 18, 0.9)',
    headerGradient: 'linear-gradient(135deg, rgba(8,5,18,0.9) 0%, rgba(88,28,135,0.5) 50%, rgba(15,23,42,0.9) 100%)',
    headerText: '#f5f3ff',

    textPrimary: '#f5f3ff',
    textSecondary: '#c4b5fd',
    textMuted: '#7c3aed',
    textInverse: '#0c0a1a',

    borderPrimary: 'rgba(139, 92, 246, 0.2)',
    borderSecondary: 'rgba(139, 92, 246, 0.3)',
    borderAccent: '#a78bfa',

    accentPrimary: '#8b5cf6',
    accentHover: '#a78bfa',
    accentLight: 'rgba(139, 92, 246, 0.2)',

    success: '#34d399',
    successLight: 'rgba(52, 211, 153, 0.2)',
    warning: '#fbbf24',
    warningLight: 'rgba(251, 191, 36, 0.2)',
    error: '#f87171',
    errorLight: 'rgba(248, 113, 113, 0.2)',
    info: '#a78bfa',
    infoLight: 'rgba(167, 139, 250, 0.2)',

    shadow: '0 8px 32px rgba(88, 28, 135, 0.3)',
    shadowLg: '0 25px 50px -12px rgba(88, 28, 135, 0.5)',
    overlay: 'rgba(12, 10, 26, 0.7)',
    glassBg: 'rgba(139, 92, 246, 0.05)',
    blur: '12px',

    scrollbarTrack: 'rgba(20, 15, 45, 0.5)',
    scrollbarThumb: 'rgba(139, 92, 246, 0.4)',
    scrollbarThumbHover: 'rgba(167, 139, 250, 0.5)',
  },
  effects: {
    gradients: true,
    backdropBlur: true,
  },
};
