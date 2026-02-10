'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type Theme, themes, getThemeById } from '@/themes';

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (themeId: string) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | null>(null);
const STORAGE_KEY = 'LULKIEWICZ_THEME';

const camelToKebab = (str: string): string =>
  str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const applyThemeToDOM = (theme: Theme) => {
  const root = document.documentElement;

  Object.entries(theme.colors).forEach(([key, value]) => {
    if (value !== undefined) {
      root.style.setProperty(`--${camelToKebab(key)}`, value);
    }
  });

  root.classList.remove('theme-glass', 'theme-gradient', 'theme-minimal', 'theme-dark');
  if (theme.effects?.glassmorphism) root.classList.add('theme-glass');
  if (theme.effects?.gradients) root.classList.add('theme-gradient');
  if (theme.id === 'dark') root.classList.add('theme-dark');

  updateScrollbarStyles(theme);
};

const updateScrollbarStyles = (theme: Theme) => {
  const styleId = 'theme-scrollbar-styles';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: ${theme.colors.scrollbarTrack}; }
    ::-webkit-scrollbar-thumb { background: ${theme.colors.scrollbarThumb}; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: ${theme.colors.scrollbarThumbHover}; }
  `;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return getThemeById(saved);
    }
    return getThemeById('glass');
  });

  useEffect(() => {
    applyThemeToDOM(currentTheme);
    localStorage.setItem(STORAGE_KEY, currentTheme.id);
  }, [currentTheme]);

  useEffect(() => {
    applyThemeToDOM(currentTheme);
  }, []);

  const setTheme = (themeId: string) => setCurrentTheme(getThemeById(themeId));

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
