/**
 * CardTitle — small uppercase eyebrow shown above card content.
 *
 * v1 preview `.card-title`: 10.5px, 0.18em tracking, ink-soft.
 */

import type { CSSProperties, PropsWithChildren } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

export function CardTitle({
  children,
  style,
}: PropsWithChildren<{ style?: CSSProperties }>) {
  const t = useTokens();
  return (
    <div
      style={{
        fontSize: 10.5,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color: t.inkSoft,
        fontWeight: 600,
        fontFamily: fonts.sans,
        marginBottom: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
