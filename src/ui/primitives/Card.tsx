/**
 * Card — base surface with v1 styling. Use for any panel-shaped content.
 */

import type { CSSProperties, PropsWithChildren } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';

type CardProps = PropsWithChildren<{
  padding?: number;
  style?: CSSProperties;
  elevated?: boolean;
}>;

export function Card({ children, padding = 18, style, elevated = false }: CardProps) {
  const t = useTokens();
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: radius.card,
        padding,
        boxShadow: elevated ? t.shadowMd : t.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
