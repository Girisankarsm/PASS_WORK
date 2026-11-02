/**
 * theme.tsx — Central theme system for Unified Engineering Workbench
 *
 * Two modes:
 *  • "blue"  — Dark navy & blue engineering palette (default)
 *  • "dark"  — True black & charcoal palette
 *
 * Strategy: toggle the data-theme attribute on <html>. CSS rules in
 * index.css override :root variables under [data-theme="dark"].
 * React context re-renders any component that needs the current theme
 * name (e.g. to pass colours directly into Recharts / Three.js).
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

export type ThemeMode = 'blue' | 'dark';

const STORAGE_KEY = 'ew-theme';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
  /** Read a CSS variable from the document root (always current theme) */
  cssVar: (name: string) => string;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'blue',
  toggleTheme: () => {},
  setTheme: () => {},
  cssVar: () => '',
});

function applyTheme(mode: ThemeMode) {
  if (mode === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return stored === 'dark' ? 'dark' : 'blue';
  });

  // Apply on first render and whenever theme changes
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);

  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === 'blue' ? 'dark' : 'blue')),
    []
  );

  const cssVar = useCallback((name: string): string => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, cssVar }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Convenience: returns the set of chart colours for the current theme */
export function useChartColors() {
  const { cssVar, theme } = useTheme();
  // Depend on theme so callers re-render when theme changes
  void theme;
  return {
    grid: cssVar('--chart-grid'),
    axis: cssVar('--chart-axis'),
    tooltipBg: cssVar('--chart-tooltip-bg'),
    tooltipBorder: cssVar('--border'),
    primary: cssVar('--primary-blue'),
  };
}
