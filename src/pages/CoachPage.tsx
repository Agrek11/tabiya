/**
 * CoachPage — Phase 4 placeholder.
 *
 * Source: specs/wireframes/tabiya-v1-preview.html `data-page="coach"`.
 * Pure placeholder until Phase 4 ships the symbolic chess understanding +
 * Stockfish grounded explanation moat.
 */

import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';

export function CoachPage() {
  const t = useTokens();
  return (
    <PageBody>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 40px',
          textAlign: 'center',
          fontFamily: fonts.sans,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 18, color: t.ink }}>♞</div>
        <h3
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: '-0.02em',
            marginBottom: 10,
          }}
        >
          AI Coach — Phase 4
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: t.inkDim,
            maxWidth: 480,
            lineHeight: 1.6,
          }}
        >
          Symbolic chess understanding layer + Stockfish-grounded explanations.
          Ask "Why this move?", get end-of-line plan recommendations, and explore
          your weaknesses with a coach that doesn't hallucinate.
        </p>
        <div
          style={{
            marginTop: 18,
            padding: '5px 12px',
            background: t.brandSoft,
            color: t.brand,
            border: `0.5px solid ${t.brandSoftBorder}`,
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Ships in Phase 4
        </div>
      </div>
    </PageBody>
  );
}
