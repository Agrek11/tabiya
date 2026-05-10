/**
 * EndOfLineSummary — card shown when a drill completes (non-queue mode).
 *
 * Displays line name, drill stats, strategic notes, and three CTAs:
 *   - Restart this line
 *   - Drill due (queue mode)
 *   - Next in family
 *
 * Mastery delta is intentionally omitted in v1c — capturing prev/next SrsState
 * cleanly across the fire-and-forget SRS write isn't worth the complexity for
 * the first iteration. Counters (wrong, hint, duration) tell the story.
 */

import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCw, Calendar, ChevronRight } from 'lucide-react';
import { useTokens } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import type { DrillResult, Line } from '../storage/types';

export function EndOfLineSummary({
  line,
  drillResult,
  dueCount,
  nextLineInFamily,
  onRestart,
  onPickLine,
}: {
  line: Line;
  drillResult: DrillResult;
  dueCount: number;
  nextLineInFamily: Line | null;
  onRestart: () => void;
  onPickLine: (lineId: string) => void;
}) {
  const t = useTokens();
  const seconds = Math.round(drillResult.duration_ms / 1000);

  return (
    <div
      data-testid="end-of-line-summary"
      style={{
        background: t.surface,
        border: `1px solid ${t.brand}`,
        borderRadius: radius.card,
        padding: 18,
        boxShadow: t.shadowMd,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <CheckCircle2 size={18} color={t.brand} />
        <span style={{ fontFamily: fonts.sans, fontWeight: 700, fontSize: 16, color: t.brand }}>
          Line complete
        </span>
      </div>
      <div style={{ fontFamily: fonts.sans, fontWeight: 600, fontSize: 15, color: t.ink, marginBottom: 12 }}>
        {line.name}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <Stat label="Plies" value={String(line.depth)} />
        <Stat label="Wrong" value={String(drillResult.wrong_attempts)} accent={drillResult.wrong_attempts === 0 ? t.brand : drillResult.wrong_attempts >= 3 ? t.red : undefined} />
        <Stat label="Hints" value={String(drillResult.hint_uses)} />
        <Stat label="Time" value={`${seconds}s`} />
      </div>

      {line.strategic_notes.length > 0 && (
        <div
          style={{
            background: t.surfaceAlt,
            borderRadius: 8,
            padding: 12,
            marginBottom: 14,
            fontFamily: fonts.sans,
            fontSize: 13,
            color: t.ink,
            lineHeight: 1.5,
          }}
        >
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {line.strategic_notes.map((note, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          onClick={onRestart}
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            color: t.ink,
            padding: '8px 14px',
            borderRadius: 999,
            fontFamily: fonts.sans,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <RotateCw size={13} /> Restart
        </button>
        {dueCount > 0 && (
          <Link to="/drill?queue=due" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: t.brand,
                color: '#fff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 999,
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Calendar size={13} /> Drill {dueCount} due
            </button>
          </Link>
        )}
        {nextLineInFamily && (
          <button
            onClick={() => onPickLine(nextLineInFamily.id)}
            style={{
              background: t.brandSoft,
              color: t.brand,
              border: 'none',
              padding: '8px 14px',
              borderRadius: 999,
              fontFamily: fonts.sans,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Next: {nextLineInFamily.name} <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const t = useTokens();
  return (
    <div
      style={{
        background: t.surfaceAlt,
        borderRadius: 8,
        padding: '8px 10px',
        textAlign: 'center',
        fontFamily: fonts.sans,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ?? t.ink }}>{value}</div>
      <div style={{ fontSize: 10.5, color: t.inkSoft, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}
