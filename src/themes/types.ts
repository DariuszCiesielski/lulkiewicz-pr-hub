export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgAccent: string;

  sidebarBg: string;
  sidebarText: string;
  sidebarHover: string;
  sidebarActive: string;

  headerBg: string;
  headerGradient: string;
  headerText: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  borderPrimary: string;
  borderSecondary: string;
  borderAccent: string;

  accentPrimary: string;
  accentHover: string;
  accentLight: string;

  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  info: string;
  infoLight: string;

  shadow: string;
  shadowLg: string;
  overlay: string;
  glassBg?: string;
  blur?: string;

  scrollbarTrack: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
}

export interface ThemeEffects {
  backdropBlur?: boolean;
  glassmorphism?: boolean;
  gradients?: boolean;
  softShadows?: boolean;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  effects?: ThemeEffects;
}

export type ThemeId = 'default' | 'dark' | 'glass' | 'minimal' | 'gradient' | 'corporate';
