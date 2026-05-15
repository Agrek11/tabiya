/**
 * StatusStrip — drill status display below the board.
 *
 * Shows:
 *   - drill state text (color-cued: red on wrong, brand on complete)
 *   - line progress (ply X of Y)
 *   - session accuracy placeholder (until SRS lands Phase 1)
 *
 * Hint + Restart action chips remain in DrillPage's status row alongside
 * this strip — this component is the read-only status block.
 */

import type { CSSProperties } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

type StatusStripProps = {
  statusText: string;
  stateKind: string;
  ply: number;       // current zero-indexed
  totalPly: number;
  accuracyText?: string;
};

export function StatusStrip({
  statusText,
  stateKind,
  ply,
  totalPly,
  accuracyText = '— %',
}: StatusStripProps) {
  const t = useTokens();
  const isWrong = stateKind === 'wrong_pending';
  const isComplete = stateKind === 'complete';
  const isThinking = stateKind === 'auto_playing';

  const statusColor = isWrong ? t.red : isComplete ? t.success : isThinking ? t.amber : t.ink;

  const containerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'wrap',
  };

  const cellStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: t.inkSoft,
    fontFamily: fonts.mono,
    letterSpacing: 0.3,
  };

  const dot: CSSProperties = {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: statusColor,
    flexShrink: 0,
    boxShadow: isThinking ? `0 0 0 4px ${t.amberSoft}` : undefined,
    transition: 'background 200ms, box-shadow 200ms',
  };

  return (
    <div style={containerStyle} data-testid="status-strip">
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 14,
          fontWeight: 600,
          color: statusColor,
          fontFamily: fonts.sans,
          flex: 1,
          minWidth: 200,
        }}
      >
        <span style={dot} />
        {statusText}
      </div>
      <div style={cellStyle}>
        <span>Ply</span>
        <span style={{ color: t.ink, fontWeight: 600 }}>
          {Math.min(ply + 1, totalPly)}/{totalPly}
        </span>
      </div>
      <div style={cellStyle}>
        <span>Accuracy</span>
        <span style={{ color: t.ink, fontWeight: 600 }}>{accuracyText}</span>
      </div>
    </div>
  );
}
