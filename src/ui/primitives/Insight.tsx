/**
 * Insight — surfaceAlt-filled rounded block used to call out short text bullets.
 *
 * v1 preview `.insight`: rounded 12px, 12-14px padding, 12.5px ink. Used on
 * Home / Repertoire / Insights / Games pages.
 */

import type { PropsWithChildren } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

export function Insight({ children }: PropsWithChildren) {
  const t = useTokens();
  return (
    <div
      style={{
        background: t.surfaceAlt,
        borderRadius: 12,
        padding: '12px 14px',
        fontSize: 12.5,
        color: t.ink,
        lineHeight: 1.55,
        fontFamily: fonts.sans,
      }}
    >
      {children}
    </div>
  );
}

export function InsightStack({ children }: PropsWithChildren) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>{children}</div>
  );
}
