/**
 * ThemeContext — provides the active theme tokens to all consumers.
 *
 * Persists the user's light/dark preference to localStorage under
 * `tabiya:colorScheme`. Defaults to system preference on first visit.
 *
 * Replaces the old `themes.ts` board-color presets — we now have one
 * unified theme system where the board palette is derived from the
 * active light/dark theme.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { darkTheme, lightTheme, type ThemeTokens } from './tokens';

export type ColorScheme = 'light' | 'dark';

type ThemeContextValue = {
  scheme: ColorScheme;
  tokens: ThemeTokens;
  setScheme: (scheme: ColorScheme) => void;
  toggle: () => void;
};

const STORAGE_KEY = 'tabiya:colorScheme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function detectInitialScheme(): ColorScheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable; fall through to media query
  }
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function ThemeProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [scheme, setSchemeState] = useState<ColorScheme>(() => detectInitialScheme());

  const setScheme = useCallback((next: ColorScheme) => {
    setSchemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — storage may be disabled
    }
  }, []);

  const toggle = useCallback(() => {
    setSchemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Reflect the scheme on <html> for any global CSS that wants it.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.colorScheme = scheme;
    document.documentElement.style.colorScheme = scheme;
  }, [scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      tokens: scheme === 'light' ? lightTheme : darkTheme,
      setScheme,
      toggle,
    }),
    [scheme, setScheme, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme must be used within <ThemeProvider>');
  }
  return ctx;
}

/** Quick accessor when you only need the tokens. */
export function useTokens(): ThemeTokens {
  return useTheme().tokens;
}
