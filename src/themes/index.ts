import type { Theme } from './types';
import { defaultTheme } from './default';
import { darkTheme } from './dark';
import { glassTheme } from './glass';
import { minimalTheme } from './minimal';
import { gradientTheme } from './gradient';
import { corporateTheme } from './corporate';

export const themes: Theme[] = [
  defaultTheme,
  darkTheme,
  glassTheme,
  minimalTheme,
  gradientTheme,
  corporateTheme,
];

export { defaultTheme, darkTheme, glassTheme, minimalTheme, gradientTheme, corporateTheme };
export type { Theme, ThemeId, ThemeColors, ThemeEffects } from './types';

export const getThemeById = (id: string): Theme => {
  return themes.find((t) => t.id === id) || glassTheme;
};
