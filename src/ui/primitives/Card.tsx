/**
 * Card — base surface with v1 styling. Use for any panel-shaped content.
 */

import type { CSSProperties, PropsWithChildren } from 'react';
import { useTokens } from '../../theme/ThemeContext';

type CardProps = PropsWithChildren<{
  padding?: number;
  style?: CSSProperties;
  elevated?: boolean;
}>;

/**
 * Card — surface panel matching v1 preview `.card`.
 *
 * Preview style: 18px radius, 0.5px border, 20px padding default.
 * `elevated` swaps the resting shadow to `shadowMd` for cards that float
 * (popovers, summaries).
 */
export function Card({ children, padding = 20, style, elevated = false }: CardProps) {
  const t = useTokens();
  return (
    <div
      style={{
        background: t.surface,
        border: `0.5px solid ${t.border}`,
        borderRadius: 18,
        padding,
        boxShadow: elevated ? t.shadowMd : t.shadowSm,
        transition: 'all 220ms ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
