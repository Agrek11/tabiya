/**
 * BoardThemeContext — global state for the user's board color preference.
 *
 * Separate from app color scheme. Persisted to localStorage. Re-renders
 * components that consume it when changed (Settings + drill quick-toggle).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  BOARD_THEMES,
  getBoardTheme,
  readBoardTheme,
  writeBoardTheme,
  type BoardTheme,
  type BoardThemeId,
} from './boardThemes';
import { useTheme } from './ThemeContext';

type BoardThemeContextValue = {
  themeId: BoardThemeId;
  /** Resolved theme (auto → app-scheme defaults). */
  theme: BoardTheme;
  setThemeId: (id: BoardThemeId) => void;
  options: BoardTheme[];
};

const BoardThemeContext = createContext<BoardThemeContextValue | null>(null);

export function BoardThemeProvider({ children }: PropsWithChildren): React.JSX.Element {
  const [themeId, setThemeIdState] = useState<BoardThemeId>(() => readBoardTheme());
  const { scheme } = useTheme();

  const setThemeId = useCallback((id: BoardThemeId): void => {
    setThemeIdState(id);
    writeBoardTheme(id);
  }, []);

  const theme: BoardTheme = useMemo(() => {
    if (themeId === 'auto') {
      // Auto: match current app color scheme.
      return scheme === 'dark'
        ? { id: 'auto', label: 'Auto', light: '#D6CCAB', dark: '#5C7345' }
        : { id: 'auto', label: 'Auto', light: '#EBECD0', dark: '#779556' };
    }
    return getBoardTheme(themeId);
  }, [themeId, scheme]);

  const value = useMemo<BoardThemeContextValue>(
    () => ({ themeId, theme, setThemeId, options: BOARD_THEMES }),
    [themeId, theme, setThemeId]
  );

  return <BoardThemeContext.Provider value={value}>{children}</BoardThemeContext.Provider>;
}

export function useBoardTheme(): BoardThemeContextValue {
  const ctx = useContext(BoardThemeContext);
  if (ctx === null) {
    throw new Error('useBoardTheme must be used within <BoardThemeProvider>');
  }
  return ctx;
}
