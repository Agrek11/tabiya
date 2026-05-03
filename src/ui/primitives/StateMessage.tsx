/**
 * StateMessage — empty / loading / error / coming-soon states.
 *
 * Single component with icon, title, body, optional action. Used wherever a
 * surface awaits data or has nothing to show.
 */

import type { ComponentType, ReactNode } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';

type StateMessageProps = {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  title: string;
  body?: string;
  action?: ReactNode;
  iconColor?: string;
};

export function StateMessage({ icon: Icon, title, body, action, iconColor }: StateMessageProps) {
  const t = useTokens();
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: radius.card,
        padding: 48,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        maxWidth: 480,
        margin: '40px auto',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: radius.chip,
          background: t.surfaceAlt,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor ?? t.inkDim,
          marginBottom: 4,
        }}
      >
        <Icon size={24} strokeWidth={2} />
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: t.ink,
          letterSpacing: -0.3,
          fontFamily: fonts.sans,
        }}
      >
        {title}
      </div>
      {body && (
        <div
          style={{
            fontSize: 14,
            color: t.inkDim,
            lineHeight: 1.5,
            fontFamily: fonts.sans,
            maxWidth: 360,
          }}
        >
          {body}
        </div>
      )}
      {action}
    </div>
  );
}
