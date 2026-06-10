/**
 * CoachModal — Surface A (Task 8.2, Design §5).
 *
 * Three stacked sections: header (line · ply · engine/preset/depth), the engine
 * card (always rendered when analysis is present), and either the LLM narration
 * card or the degraded footer "Configure AI in Settings to enable narration."
 * A wasm-load failure renders an engine-unavailable notice; the drill stays
 * usable. Closes on ESC / click-outside / ✕ — drill state is untouched
 * (Article 11).
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { useCoach } from '../../hooks/useCoach';
import { formatEval } from '../../coach/CoachPipeline';
import type { PlyHistoryEntry } from '../../coach/CoachContext';

export type CoachModalProps = {
  lineName: string;
  lineId?: string;
  plyIndex: number;
  fen: string;
  history: PlyHistoryEntry[];
  onClose: () => void;
};

export function CoachModal(props: CoachModalProps) {
  const t = useTokens();
  const { lineName, lineId, plyIndex, fen, history, onClose } = props;
  const { result, loading, error, invoke } = useCoach({ lineId, plyIndex, fen, history });

  // Invoke once when the modal opens (and when the target position changes).
  useEffect(() => {
    invoke();
  }, [invoke]);

  // ESC to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const engine = result?.engine ?? null;
  const llm = result?.llm;
  const engineUnavailable = result?.error === 'engine-unavailable' || error !== null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Coach explanation"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.surface,
          border: `0.5px solid ${t.border}`,
          borderRadius: 14,
          boxShadow: t.shadowLg,
          width: 'min(560px, 100%)',
          maxHeight: '85vh',
          overflowY: 'auto',
          fontFamily: fonts.sans,
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 16px',
            borderBottom: `0.5px solid ${t.border}`,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>
            Coach — {lineName} · ply {plyIndex}
            {engine ? (
              <span style={{ color: t.inkSoft, fontWeight: 500 }}>
                {' '}
                · {engine.engineName} d{engine.engineDepth}
              </span>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close coach"
            style={{
              background: 'transparent',
              border: 'none',
              color: t.inkSoft,
              cursor: 'pointer',
              display: 'flex',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading && !result ? (
            <div style={{ fontSize: 13, color: t.inkDim }}>Analyzing…</div>
          ) : null}

          {engineUnavailable ? (
            <div
              data-testid="coach-modal-engine-unavailable"
              style={{ fontSize: 13, color: t.inkDim, lineHeight: 1.6 }}
            >
              Engine unavailable — try reloading. Drill remains usable.
            </div>
          ) : null}

          {engine ? (
            <section>
              <SectionLabel>Engine</SectionLabel>
              <div
                style={{
                  fontSize: 13,
                  color: t.ink,
                  fontFamily: fonts.mono,
                  marginBottom: 8,
                }}
              >
                Best: {engine.bestmove}{' '}
                <span style={{ color: t.brand }}>
                  ({formatEval(engine.pvs[0]?.scoreCp ?? 0, engine.pvs[0]?.mateIn)})
                </span>
              </div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {engine.pvs.map((pv, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontSize: 12.5,
                      fontFamily: fonts.mono,
                      color: t.inkDim,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      PV {i + 1}: {pv.moves.slice(0, 8).join(' ')}
                    </span>
                    <span style={{ color: t.inkSoft, flexShrink: 0 }}>
                      {formatEval(pv.scoreCp, pv.mateIn)} · d{pv.depth}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {engine && llm ? (
            <section data-testid="coach-modal-narration">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <SectionLabel>Narration</SectionLabel>
                <span
                  style={{
                    fontSize: 10.5,
                    color: t.inkSoft,
                    fontFamily: fonts.mono,
                    background: t.surfaceAlt,
                    border: `0.5px solid ${t.border}`,
                    borderRadius: 999,
                    padding: '2px 8px',
                  }}
                >
                  {llm.modelName}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13.5, color: t.ink, lineHeight: 1.6 }}>{llm.text}</p>
            </section>
          ) : null}

          {engine && !llm && !loading ? (
            <div
              data-testid="coach-modal-degraded"
              style={{
                fontSize: 12.5,
                color: t.inkDim,
                background: t.surfaceAlt,
                border: `0.5px solid ${t.border}`,
                borderRadius: 10,
                padding: '10px 12px',
                lineHeight: 1.55,
              }}
            >
              Configure AI in Settings to enable narration.
            </div>
          ) : null}

          {/* Honest-baseline note (Design §5). */}
          {engine ? (
            <div style={{ fontSize: 11, color: t.inkSoft, lineHeight: 1.5 }}>
              ⓘ This is a naive baseline. Upcoming coach layers replace this prose
              with grounded, hallucination-checked explanations.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const t = useTokens();
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: t.inkSoft,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}
