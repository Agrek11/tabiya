/**
 * Board theme presets — color pairs for chess board light/dark squares.
 *
 * Independent from the app's light/dark color scheme. User picks a board
 * theme separately. Persisted to localStorage `tabiya.boardTheme`.
 *
 * Defaults derive from the app color scheme if no preference set.
 */

export type BoardThemeId =
  | 'auto'
  | 'lichess-classic'
  | 'blue'
  | 'green'
  | 'brown'
  | 'wood'
  | 'slate';

export type BoardTheme = {
  id: BoardThemeId;
  label: string;
  light: string;
  dark: string;
};

export const BOARD_THEMES: BoardTheme[] = [
  // 'auto' is a sentinel — actual colors derive from app color scheme.
  { id: 'auto', label: 'Auto (match theme)', light: '#EBECD0', dark: '#779556' },
  { id: 'lichess-classic', label: 'Lichess', light: '#F0D9B5', dark: '#B58863' },
  { id: 'blue', label: 'Blue', light: '#DEE3E6', dark: '#788A94' },
  { id: 'green', label: 'Green', light: '#EBECD0', dark: '#779556' },
  { id: 'brown', label: 'Brown', light: '#F0D9B5', dark: '#946F51' },
  { id: 'wood', label: 'Wood', light: '#F1D5B6', dark: '#A57956' },
  { id: 'slate', label: 'Slate', light: '#E0E0E0', dark: '#5C6873' },
];

export const DEFAULT_BOARD_THEME: BoardThemeId = 'auto';

const KEY = 'tabiya.boardTheme';

export function readBoardTheme(): BoardThemeId {
  if (typeof window === 'undefined') return DEFAULT_BOARD_THEME;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_BOARD_THEME;
    const found = BOARD_THEMES.find((t) => t.id === raw);
    return found ? found.id : DEFAULT_BOARD_THEME;
  } catch {
    return DEFAULT_BOARD_THEME;
  }
}

export function writeBoardTheme(id: BoardThemeId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* quota / private */
  }
}

export function getBoardTheme(id: BoardThemeId): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0]!;
}
