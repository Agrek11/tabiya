/**
 * PageHeader — title + optional subtitle, used at the top of every page.
 */

import type { PropsWithChildren, ReactNode } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, subtitle, actions }: PropsWithChildren<PageHeaderProps>) {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 28,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 38,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            fontFamily: fonts.sans,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              margin: '8px 0 0',
              color: t.inkDim,
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: fonts.sans,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
