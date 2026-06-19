/**
 * EndOfLineSummary — card shown when a drill completes (non-queue mode).
 *
 * Rebuilt for v1 preview language: centered surface card with success eyebrow,
 * stat tiles, optional strategic notes, and three CTAs. Queue mode does NOT
 * render this — it auto-advances with a toast instead.
 *
 * Mastery delta intentionally omitted (Phase 1c) — counter strip tells the
 * story.
 */

import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCw, Calendar, ChevronRight } from 'lucide-react';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { Card } from './primitives/Card';
import { CardTitle } from './primitives/CardTitle';
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
    <Card
      elevated
      style={{ border: `0.5px solid ${t.success}`, position: 'relative' }}
    >
      <div data-testid="end-of-line-summary">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <CheckCircle2 size={18} color={t.success} />
          <CardTitle style={{ color: t.success, marginBottom: 0 }}>Line Complete</CardTitle>
        </div>
        <div
          style={{
            fontFamily: fonts.sans,
            fontWeight: 700,
            fontSize: 22,
            color: t.ink,
            marginTop: 4,
            marginBottom: 14,
            letterSpacing: '-0.02em',
          }}
        >
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
          <Stat
            label="Wrong"
            value={String(drillResult.wrong_attempts)}
            accent={drillResult.wrong_attempts === 0 ? t.success : t.red}
          />
          <Stat label="Hints" value={String(drillResult.hint_uses)} />
          <Stat label="Time" value={`${seconds}s`} />
        </div>

        {line.strategic_notes.length > 0 && (
          <div
            style={{
              background: t.surfaceAlt,
              borderRadius: 10,
              padding: 12,
              marginBottom: 14,
              fontFamily: fonts.sans,
              fontSize: 13,
              color: t.ink,
              lineHeight: 1.55,
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
            style={summaryGhostBtn(t)}
          >
            <RotateCw size={13} /> Restart
          </button>
          {dueCount > 0 && (
            <Link to="/drill?queue=due" style={{ textDecoration: 'none' }}>
              <button style={summaryPrimaryBtn(t)}>
                <Calendar size={13} /> Drill {dueCount} due
              </button>
            </Link>
          )}
          {nextLineInFamily && (
            <button
              onClick={() => onPickLine(nextLineInFamily.id)}
              style={summarySoftBtn(t)}
            >
              Next: {nextLineInFamily.name} <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  const t = useTokens();
  return (
    <div
      style={{
        background: t.surfaceAlt,
        borderRadius: 10,
        padding: '10px 12px',
        textAlign: 'center',
        fontFamily: fonts.sans,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? t.ink, letterSpacing: '-0.02em' }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 10.5,
          color: t.inkSoft,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function summaryPrimaryBtn(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    background: t.brand,
    color: t.brandInk,
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
  };
}

function summarySoftBtn(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
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
  };
}

function summaryGhostBtn(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    background: t.surface,
    border: `0.5px solid ${t.border}`,
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
  };
}
