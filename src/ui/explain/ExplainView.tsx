/**
 * ExplainView — Phase 1b composition root for Explain Mode.
 *
 * Owns:
 *   - `useExplainMode` (state machine + chess.js + autoplay timer)
 *   - `useExplainTts` (TTS lifecycle hooked to state transitions)
 *   - <ChessBoardPanel> rendering with HighlightLayer + ArrowLayer overlays
 *   - <ExplainRail> control + rationale render
 *   - End-of-line completion banner with "Drill this line" CTA
 *
 * Overlays clear (empty arrays passed) when state is not `showOverlays` —
 * the move plays cleanly on a quiet board (R3 AC).
 *
 * CHOICE: completion uses a minimal in-component banner rather than
 * <EndOfLineSummary>. The existing summary requires a non-null `DrillResult`
 * which Explain does not produce — passing null would force widening that
 * component's prop type just for one caller. A purpose-built banner stays
 * cleaner and avoids regressing the drill summary.
 *
 * Article 11 (local-first): TTS is browser-native, no network.
 * Article 14 (type discipline): strict TS, no `any`.
 * Article 15 (single highlight primitive): HighlightLayer consumed in
 * `spotlight` mode here; Phase 2 will consume the same component in `bright`.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Sparkles, Swords } from 'lucide-react';
import { ChessBoardPanel } from '../ChessBoardPanel';
import { useTokens } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';
import type { ExplainBlock, KeySquare, Line } from '../../storage/types';
import { useExplainMode } from '../../hooks/useExplainMode';
import { useExplainTts } from '../../hooks/useExplainTts';
import { useSpotlightOverlay } from '../board/useSpotlightOverlay';
import { ExplainRail } from './ExplainRail';

export type ExplainViewProps = {
  line: Line;
  blocks: readonly ExplainBlock[];
  /** Board orientation — typically the opening's drill color. */
  playerColor: 'white' | 'black';
  /** Total ply count for the progress bar. */
  totalPlies: number;
  /** Current ply count for the progress bar — re-mounted on line change. */
  progressBarPlyOverride?: number;
  /** Called when user clicks "Skip to drill" or "Drill this line". */
  onSkipToDrill(): void;
  /**
   * Phase 2b R7.3 — Pattern Viz key squares to force-render under the
   * board for the duration of the explain run, regardless of the drill-
   * mode toggle. Optional; absent / empty → no extra overlay (the
   * per-ply explain highlights from `blocks` are unaffected).
   */
  patternKeySquares?: readonly KeySquare[];
};

const ARROW_HEX: Record<'green' | 'red' | 'blue', string> = {
  green: '#15803d',
  red: '#c0392b',
  blue: '#1d4ed8',
};

export function ExplainView({
  line,
  blocks,
  playerColor,
  totalPlies,
  onSkipToDrill,
  patternKeySquares,
}: ExplainViewProps): React.JSX.Element {
  const t = useTokens();
  const [paused, setPaused] = useState(false);

  const explain = useExplainMode({
    moves: line.moves,
    blocks,
    paused,
  });
  const tts = useExplainTts({ lineId: line.id, paused });

  // Speak rationale on each new showOverlays cycle. Cancel TTS on pause / line
  // change / skip / unmount (cleanup runs naturally as state changes).
  const lastSpokenPlyRef = useRef<number | null>(null);
  useEffect(() => {
    if (explain.state.kind !== 'showOverlays') return;
    const block = blocks[explain.state.lineIndex];
    if (!block) return;
    // Only speak once per ply (don't re-speak on pause/resume).
    if (lastSpokenPlyRef.current === explain.state.lineIndex) return;
    lastSpokenPlyRef.current = explain.state.lineIndex;
    tts.speak(block.rationale);
  }, [explain.state, blocks, tts]);

  // Reset lastSpokenPlyRef when line changes (new line = new rationale flow).
  useEffect(() => {
    lastSpokenPlyRef.current = null;
  }, [line.id]);

  // Cancel TTS on pause flips.
  useEffect(() => {
    if (paused) tts.cancel();
  }, [paused, tts]);

  // Cancel + onSkipToDrill on user skip — the state machine drives `complete`
  // with skipped=true. We watch for that and call the callback synchronously.
  useEffect(() => {
    if (explain.state.kind === 'complete' && explain.state.skipped) {
      tts.cancel();
      onSkipToDrill();
    }
  }, [explain.state, tts, onSkipToDrill]);

  // Cancel TTS on unmount.
  useEffect(() => () => tts.cancel(), [tts]);

  // Keyboard: ←/→ step prev/next, Space toggles pause. DrillPage's handler
  // yields the keyboard to Explain Mode while it's active, so no double-firing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        explain.prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        explain.next();
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setPaused((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [explain]);

  // Overlays — only present during showOverlays. Other states render empty.
  const activeBlock: ExplainBlock | null = explain.currentBlock;
  const arrows = activeBlock?.arrows ?? [];

  // Native react-chessboard arrows (lichess-style), shown only while overlays
  // are visible for the current ply.
  const nativeArrows =
    explain.state.kind === 'showOverlays'
      ? arrows.map((a) => ({
          startSquare: a.from,
          endSquare: a.to,
          color: ARROW_HEX[a.color ?? 'green'],
        }))
      : [];

  // Pattern Viz spotlight — rendered ONLY when the caller passes key squares
  // (the user toggled Pattern Viz on). Otherwise the board stays clean and the
  // move arrow carries the point; per-ply move squares are not dimmed.
  const patternOverlay = useSpotlightOverlay({
    keySquares: patternKeySquares,
    fadePieces: false,
  });

  // Last-move tint + the toggle-gated pattern spotlight. No block-highlight dim.
  const squareStylesWithLastMove = useMemo<Record<string, CSSProperties>>(() => {
    const styles: Record<string, CSSProperties> = { ...patternOverlay.squareStyles };
    if (explain.lastMove !== null && explain.state.kind !== 'showOverlays') {
      const lastStyle: CSSProperties = { backgroundColor: 'rgba(155, 199, 0, 0.42)' };
      styles[explain.lastMove.from] = { ...lastStyle, ...(styles[explain.lastMove.from] ?? {}) };
      styles[explain.lastMove.to] = { ...lastStyle, ...(styles[explain.lastMove.to] ?? {}) };
    }
    return styles;
  }, [patternOverlay.squareStyles, explain.lastMove, explain.state]);

  const progressPct = totalPlies === 0 ? 0 : ((explain.currentPly + 1) / totalPlies) * 100;
  const isComplete = explain.state.kind === 'complete' && !explain.state.skipped;

  return (
    <div
      data-testid="explain-view"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 340px',
        gap: 16,
        alignItems: 'start',
        justifyContent: 'center',
        minWidth: 0,
      }}
    >
      {/* Board column — same size + orientation as drill mode. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div
          aria-label={`Explain progress ${Math.round(progressPct)}%`}
          role="progressbar"
          aria-valuenow={Math.round(progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ height: 10, background: t.surfaceAlt, borderRadius: 999, overflow: 'hidden' }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: t.brand,
              borderRadius: 999,
              transition: 'width 300ms ease-out',
            }}
          />
        </div>
        <div
          data-testid="explain-board-wrapper"
          style={{
            position: 'relative',
            width: 'min(900px, calc(100vh - 230px))',
            height: 'min(900px, calc(100vh - 230px))',
            borderRadius: 16,
            overflow: 'hidden',
            border: `0.5px solid ${t.border}`,
            background: t.surface,
          }}
        >
          <ChessBoardPanel
            fen={explain.fen}
            flashOverlay={null}
            boardOrientation={playerColor}
            squareStyles={squareStylesWithLastMove}
            arrows={nativeArrows}
            onPieceDrop={() => false}
          />
          {patternOverlay.tooltip}
        </div>
      </div>

      {/* Right column — narration rail (or completion), like drill's Moves panel. */}
      <div style={{ minWidth: 0 }}>
        {isComplete ? (
        <div
          data-testid="explain-complete"
          style={{
            background: t.surface,
            border: `1px solid ${t.brand}`,
            borderRadius: radius.card,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color={t.brand} />
            <span
              style={{
                fontFamily: fonts.sans,
                fontWeight: 700,
                fontSize: 15,
                color: t.brand,
              }}
            >
              Line walked
            </span>
          </div>
          <div style={{ fontFamily: fonts.sans, fontSize: 14, color: t.ink }}>
            Ready to drill {line.name}?
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onSkipToDrill}
              style={{
                background: t.brand,
                color: '#fff',
                border: 'none',
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Swords size={14} /> Drill this line
            </button>
            <button
              type="button"
              onClick={() => explain.restart()}
              style={{
                background: 'transparent',
                color: t.ink,
                border: `1px solid ${t.border}`,
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              Watch again
            </button>
          </div>
        </div>
      ) : (
        <ExplainRail
          key={explain.currentPly}
          block={activeBlock}
          ply={explain.currentPly}
          totalPlies={totalPlies}
          paused={paused}
          canPrev={explain.canPrev}
          canNext={explain.canNext}
          onPrev={explain.prev}
          onNext={explain.next}
          onTogglePause={() => setPaused((v) => !v)}
          onRestart={explain.restart}
          onSkip={explain.skip}
          ttsEnabledGlobal={tts.globalEnabled}
          ttsMutedForLine={tts.mutedForLine}
          onToggleLineMute={tts.toggleLineMute}
        />
      )}
      </div>
    </div>
  );
}
