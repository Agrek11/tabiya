/**
 * CoachSlot — "Ask Coach" surface on the OOB position viewer (Phase 4).
 *
 * Opens the shared CoachModal on the out-of-book position (`fenAtOOB`). The
 * engine analyzes any FEN, so this works on real-game positions today; LLM
 * narration is added when AI is configured in Settings, otherwise it degrades
 * to engine-only (Article 11). Deterministic feature facts are catalog-only
 * until the runtime extractor lands — non-catalog FENs fall back to the v1
 * engine-only path inside CoachPipeline.
 */

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { CoachModal } from './CoachModal';

export interface CoachSlotProps {
  gameId: string;
  plyIndex: number;
  fenAtOOB: string;
  playedSAN: string;
  expectedSANs: string[];
  lineId: string | null;
}

export function CoachSlot(props: CoachSlotProps) {
  const t = useTokens();
  const [open, setOpen] = useState(false);
  const { plyIndex, fenAtOOB, lineId } = props;

  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask the coach about this position"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: t.surfaceAlt,
          border: `0.5px solid ${t.border}`,
          borderRadius: 999,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: fonts.sans,
          color: t.ink,
          cursor: 'pointer',
        }}
      >
        <Sparkles size={12} />
        Ask Coach
      </button>
      {open ? (
        <CoachModal
          lineName="Out-of-book position"
          lineId={lineId ?? undefined}
          plyIndex={plyIndex}
          fen={fenAtOOB}
          history={[]}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
