/**
 * WhyThisMoveRail — right-rail card that surfaces the line's strategic
 * rationale during a drill.
 *
 * Inputs feed from the existing Line schema:
 *   - strategic_notes[0]  → "Main Idea" body (first note carries the headline
 *                           rationale; remaining notes display in stacked
 *                           paragraphs).
 *   - key_squares         → "Key Squares" chip strip (monospaced tags).
 *
 * Empty state (no notes, no key squares) shows a placeholder pointing at
 * Explain Mode, which authors per-ply rationale.
 */

import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Card } from '../../ui/primitives/Card';
import { CardTitle } from '../../ui/primitives/CardTitle';

export function WhyThisMoveRail({
  notes,
  keySquares,
}: {
  notes: readonly string[];
  keySquares: readonly string[];
}) {
  const t = useTokens();
  const mainIdea = notes[0] ?? null;
  const extras = notes.slice(1);

  if (mainIdea === null && keySquares.length === 0) {
    return (
      <Card>
        <CardTitle>Why This Move</CardTitle>
        <div
          style={{
            fontSize: 13,
            color: t.inkDim,
            lineHeight: 1.6,
            fontFamily: fonts.sans,
            fontStyle: 'italic',
          }}
        >
          Move-by-move rationale coming in Explain mode.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Why This Move</CardTitle>
      {mainIdea !== null && (
        <>
          <RailLabel>Main Idea</RailLabel>
          <div
            style={{
              fontSize: 13,
              color: t.ink,
              lineHeight: 1.6,
              marginBottom: 16,
              fontFamily: fonts.sans,
            }}
          >
            {mainIdea}
          </div>
        </>
      )}
      {extras.map((note, i) => (
        <div
          key={i}
          style={{
            fontSize: 13,
            color: t.ink,
            lineHeight: 1.6,
            marginBottom: 12,
            fontFamily: fonts.sans,
          }}
        >
          {note}
        </div>
      ))}
      {keySquares.length > 0 && (
        <>
          <RailLabel>Key Squares</RailLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {keySquares.map((sq) => (
              <span
                key={sq}
                style={{
                  padding: '4px 9px',
                  background: t.surfaceAlt,
                  color: t.ink,
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontFamily: fonts.mono,
                  fontWeight: 500,
                }}
              >
                {sq}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  const t = useTokens();
  return (
    <div
      style={{
        fontSize: 12,
        color: t.brand,
        fontWeight: 600,
        marginBottom: 6,
        fontFamily: fonts.sans,
      }}
    >
      {children}
    </div>
  );
}
