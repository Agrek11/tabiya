/**
 * Design tokens — the v1 design system.
 *
 * Source of truth: `specs/wireframes/tabiya-v1-preview.html` (locked v1 mockup).
 * Both light and dark themes share the same shape so a single theme switch
 * swaps every token together.
 *
 * Constitution Article 1: tokens are pure data, OSS-clean by definition.
 *
 * Brand vs success split (introduced 2026-05-15 with v1-preview rebuild):
 *   brand   = identity + primary action (aubergine light / gold dark)
 *   success = mastery / correctness / completion (green both themes)
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

  // Brand (identity + primary CTA — NOT correctness)
  brand: string;
  brandSoft: string;
  brandSoftBorder: string;
  brandInk: string;
  brandHover: string;

  // Success (correctness + mastery + completion)
  success: string;
  successSoft: string;

  // Semantic accents
  red: string;
  redSoft: string;
  amber: string;
  amberSoft: string;

  // Board defaults (overridable by Settings board theme picker)
  boardLight: string;
  boardDark: string;

  // Shadows
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
};

export const lightTheme: ThemeTokens = {
  bg: '#FAF7F4',
  surface: '#FFFEFB',
  surfaceAlt: '#F1E8E3',
  border: '#E8DFD9',
  borderStrong: '#D6CBC2',
  ink: '#1F1418',
  inkDim: '#5C5063',
  inkSoft: '#998F84',
  brand: '#6D2E5C',
  brandSoft: '#F5E8F0',
  brandSoftBorder: 'rgba(109, 46, 92, 0.22)',
  brandInk: '#FFFFFF',
  brandHover: '#5A2549',
  success: '#047857',
  successSoft: '#D1FAE5',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  boardLight: '#F0D9B5',
  boardDark: '#B58863',
  shadowSm: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.08)',
  shadowLg: '0 20px 50px rgba(0,0,0,0.12)',
};

export const darkTheme: ThemeTokens = {
  bg: '#0F1113',
  surface: '#15181B',
  surfaceAlt: '#1A1D20',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.15)',
  ink: '#ECE7DD',
  inkDim: '#9B9488',
  inkSoft: '#6E6759',
  brand: '#C9A96A',
  brandSoft: 'rgba(201,169,106,0.12)',
  brandSoftBorder: 'rgba(201,169,106,0.3)',
  brandInk: '#111111',
  brandHover: '#D8BC83',
  success: '#10B981',
  successSoft: 'rgba(16,185,129,0.16)',
  red: '#EF4444',
  redSoft: 'rgba(239,68,68,0.16)',
  amber: '#F59E0B',
  amberSoft: 'rgba(245,158,11,0.16)',
  boardLight: '#D9C2A1',
  boardDark: '#7B5B43',
  shadowSm: '0 1px 2px rgba(0,0,0,0.20), 0 4px 12px rgba(0,0,0,0.30)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.35)',
  shadowLg: '0 30px 80px rgba(0,0,0,0.50)',
};

// Typography stack
export const fonts = {
  sans: `Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
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
