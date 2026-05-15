/**
 * ExplainRail — Phase 1b R3/R6/R7 narration rail for Explain Mode.
 *
 * Renders the current ply's rationale (with R7 truncation) and the autoplay
 * controls (Prev / Pause / Next / Restart / Skip-to-drill). Speaker icon for
 * per-line TTS mute shows only when the global TTS flag is on.
 *
 * Pure presentational — all state via props. Parent (`ExplainView`) drives
 * remount-on-ply via `key={ply}` so the truncate state resets automatically.
 *
 * Article 14 — strict TS, no `any`.
 */

import { Pause, Play, RotateCcw, SkipForward, StepBack, StepForward, Volume2, VolumeX } from 'lucide-react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';
import type { ExplainBlock } from '../../storage/types';
import { TruncatedText } from './TruncatedText';

export type ExplainRailProps = {
  /** Block for the current ply, or null when not in showOverlays state. */
  block: ExplainBlock | null;
  /** Zero-based ply index for the current step. */
  ply: number;
  /** Total ply count for the line. */
  totalPlies: number;
  /** When true, autoplay timer is frozen. */
  paused: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev(): void;
  onNext(): void;
  onTogglePause(): void;
  onRestart(): void;
  onSkip(): void;
  /** Global TTS flag — when off, the speaker icon is hidden. */
  ttsEnabledGlobal: boolean;
  /** Per-line mute state. Only relevant when global flag is on. */
  ttsMutedForLine: boolean;
  onToggleLineMute(): void;
};

function plyHeader(ply: number): string {
  // Color: White moves on even ply (0, 2, 4...), Black on odd.
  const color = ply % 2 === 0 ? 'White' : 'Black';
  // We don't have the SAN here (would require threading moves prop just for a
  // string). For v1 we show the ply # and the color whose move this is.
  return `Ply ${ply + 1} — ${color} to move`;
}

export function ExplainRail({
  block,
  ply,
  totalPlies,
  paused,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onTogglePause,
  onRestart,
  onSkip,
  ttsEnabledGlobal,
  ttsMutedForLine,
  onToggleLineMute,
}: ExplainRailProps): React.JSX.Element {
  const t = useTokens();

  const btnStyle = {
    background: 'transparent',
    border: `1px solid ${t.border}`,
    borderRadius: 999,
    padding: '7px 13px',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: 500,
    color: t.ink,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  } as const;
  const disabledBtnStyle = { ...btnStyle, opacity: 0.5, cursor: 'not-allowed' } as const;

  return (
    <div
      data-testid="explain-rail"
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: radius.card,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: t.inkSoft,
            fontWeight: 700,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            fontFamily: fonts.sans,
          }}
        >
          {plyHeader(ply)}{' '}
          <span style={{ color: t.inkDim, fontWeight: 500 }}>
            ({ply + 1}/{totalPlies})
          </span>
        </div>
        {ttsEnabledGlobal && (
          <button
            type="button"
            onClick={onToggleLineMute}
            aria-label={ttsMutedForLine ? 'Unmute speech for this line' : 'Mute speech for this line'}
            title={ttsMutedForLine ? 'Speech muted (this line)' : 'Speech on (this line)'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: ttsMutedForLine ? t.inkDim : t.brand,
              display: 'inline-flex',
            }}
          >
            {ttsMutedForLine ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        )}
      </div>

      {block !== null ? (
        <>
          <div
            data-testid="explain-rationale"
            style={{
              fontFamily: fonts.sans,
              fontSize: 14,
              color: t.ink,
              lineHeight: 1.55,
            }}
          >
            <TruncatedText text={block.rationale} />
          </div>
          {block.threats !== undefined && block.threats !== null && block.threats.length > 0 && (
            <div
              data-testid="explain-threats"
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                color: t.inkDim,
                lineHeight: 1.5,
                paddingTop: 8,
                borderTop: `1px solid ${t.border}`,
              }}
            >
              <strong style={{ color: t.inkSoft, marginRight: 6, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Threats
              </strong>
              <TruncatedText text={block.threats} />
            </div>
          )}
        </>
      ) : (
        <div
          data-testid="explain-rationale-empty"
          style={{
            fontFamily: fonts.sans,
            fontSize: 13,
            color: t.inkDim,
            fontStyle: 'italic',
          }}
        >
          …
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: 4,
        }}
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Previous ply"
          style={canPrev ? btnStyle : disabledBtnStyle}
        >
          <StepBack size={14} /> Prev
        </button>
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={paused ? 'Resume autoplay' : 'Pause autoplay'}
          style={btnStyle}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />} {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next ply"
          style={canNext ? btnStyle : disabledBtnStyle}
        >
          <StepForward size={14} /> Next
        </button>
        <button
          type="button"
          onClick={onRestart}
          aria-label="Restart line"
          style={btnStyle}
        >
          <RotateCcw size={14} /> Restart
        </button>
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip to drill"
          style={{ ...btnStyle, marginLeft: 'auto' }}
        >
          <SkipForward size={14} /> Skip to drill
        </button>
      </div>
    </div>
  );
}
