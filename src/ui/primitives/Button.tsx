/**
 * Buttons — primary, secondary, ghost, chip variants.
 *
 * All share the v1 visual language: 6px radius, 13px body, 6-14px padding,
 * brand color accents, soft hover.
 */

import type { ButtonHTMLAttributes, CSSProperties, PropsWithChildren } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'chip';
type Tone = 'default' | 'danger';

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    tone?: Tone;
    fullWidth?: boolean;
  }
>;

export function Button({
  variant = 'secondary',
  tone = 'default',
  fullWidth,
  children,
  style,
  ...rest
}: ButtonProps) {
  const t = useTokens();
  const base: CSSProperties = {
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: 500,
    cursor: rest.disabled ? 'not-allowed' : 'pointer',
    borderRadius: radius.chip,
    padding: '8px 14px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: fullWidth ? '100%' : undefined,
    transition: 'background 120ms ease-out, color 120ms ease-out',
    opacity: rest.disabled ? 0.5 : 1,
  };

  let variantStyle: CSSProperties;
  if (variant === 'primary') {
    variantStyle = { background: t.brand, color: '#FFF', border: 'none', fontWeight: 600 };
  } else if (variant === 'secondary') {
    variantStyle = {
      background: t.surface,
      color: tone === 'danger' ? t.red : t.ink,
      border: `1px solid ${t.borderStrong}`,
    };
  } else if (variant === 'ghost') {
    variantStyle = {
      background: 'transparent',
      color: tone === 'danger' ? t.red : t.inkDim,
      border: 'none',
    };
  } else {
    // chip
    variantStyle = {
      background: 'transparent',
      color: tone === 'danger' ? t.red : t.ink,
      border: `1px solid ${t.border}`,
      padding: '6px 12px',
    };
  }

  return (
    <button {...rest} style={{ ...base, ...variantStyle, ...style }}>
      {children}
    </button>
  );
}
