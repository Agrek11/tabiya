/**
 * Board theme presets.
 *
 * Three nicer-looking presets than react-chessboard's default. Selection
 * persists to localStorage under STORAGE_KEY. Theme changes do not affect
 * drill state — purely cosmetic.
 */

export type BoardTheme = {
  id: string;
  name: string;
  light: string; // hex/rgba for light squares
  dark: string;  // hex/rgba for dark squares
};

export const THEMES: readonly BoardTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    light: '#eeeed2',
    dark: '#769656',
  },
  {
    id: 'mocha',
    name: 'Mocha',
    light: '#f0d9b5',
    dark: '#b58863',
  },
  {
    id: 'slate',
    name: 'Slate',
    light: '#dee3e6',
    dark: '#8ca2ad',
  },
] as const;

export const DEFAULT_THEME = THEMES[0]; // 'classic'

const STORAGE_KEY = 'tabiya:boardTheme';

export function loadStoredTheme(): BoardTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const id = window.localStorage.getItem(STORAGE_KEY);
    const found = THEMES.find((t) => t.id === id);
    return found ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: BoardTheme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // Storage may be disabled (private mode); silently ignore.
  }
}
