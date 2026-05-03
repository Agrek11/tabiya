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
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.5,
            fontFamily: fonts.sans,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: '6px 0 0',
              color: t.inkDim,
              fontSize: 14.5,
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
