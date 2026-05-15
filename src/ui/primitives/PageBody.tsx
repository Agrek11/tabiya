/**
 * PageBody — page padding container matching v1 preview `.page-body`.
 *
 * Source: specs/wireframes/tabiya-v1-preview.html `.page-body` = 32px/36px
 * padding with overflow scroll. Pages render their content inside this so the
 * AppShell can stay layout-agnostic.
 *
 * `flush` disables padding for pages that own the full viewport (e.g. Drill,
 * which has its own toolbar gutter).
 */

import type { CSSProperties, PropsWithChildren } from 'react';

type PageBodyProps = PropsWithChildren<{
  flush?: boolean;
  style?: CSSProperties;
}>;

export function PageBody({ children, flush = false, style }: PageBodyProps) {
  return (
    <div
      style={{
        flex: 1,
        padding: flush ? 0 : '32px 36px',
        overflowY: 'auto',
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
