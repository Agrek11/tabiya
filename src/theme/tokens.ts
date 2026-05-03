/**
 * Design tokens — the v1 design system.
 *
 * Source of truth: `wireframe.jsx` (locked v1 mockup).
 * Both light and dark themes share the same shape so a single theme switch
 * swaps every token together.
 *
 * Constitution Article 1: tokens are pure data, OSS-clean by definition.
 */

export type ThemeTokens = {
  // Surfaces
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;

  // Ink (text)
  ink: string;
  inkDim: string;
  inkSoft: string;

  // Brand (primary green)
  brand: string;
  brandSoft: string;
  brandHover: string;

  // Semantic accents
  amber: string;
  amberSoft: string;
  red: string;
  redSoft: string;
  blue: string;
  blueSoft: string;
  pink: string;
  pinkSoft: string;
  violet: string;
  violetSoft: string;

  // Shadows
  shadow: string;
  shadowMd: string;
};

export const lightTheme: ThemeTokens = {
  bg: '#FAF8F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F1E8',
  border: '#E9E4D6',
  borderStrong: '#D6CFB9',
  ink: '#1C1917',
  inkDim: '#78716C',
  inkSoft: '#A8A29E',
  brand: '#047857',
  brandSoft: '#D1FAE5',
  brandHover: '#065F46',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  blue: '#2563EB',
  blueSoft: '#DBEAFE',
  pink: '#DB2777',
  pinkSoft: '#FCE7F3',
  violet: '#7C3AED',
  violetSoft: '#EDE9FE',
  shadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.08)',
};

export const darkTheme: ThemeTokens = {
  bg: '#0F0F11',
  surface: '#18181B',
  surfaceAlt: '#27272A',
  border: '#2A2A2E',
  borderStrong: '#3F3F46',
  ink: '#FAFAFA',
  inkDim: '#A1A1AA',
  inkSoft: '#71717A',
  brand: '#10B981',
  brandSoft: '#064E3B',
  brandHover: '#34D399',
  amber: '#F59E0B',
  amberSoft: '#451A03',
  red: '#EF4444',
  redSoft: '#450A0A',
  blue: '#3B82F6',
  blueSoft: '#172554',
  pink: '#EC4899',
  pinkSoft: '#500724',
  violet: '#A78BFA',
  violetSoft: '#2E1065',
  shadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.5)',
};

// Typography stack
export const fonts = {
  sans: `'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace`,
};

// Spacing scale (use these, not magic numbers)
export const sp = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
};

// Border radius scale
export const radius = {
  chip: 6,
  card: 12,
  full: 999,
};
