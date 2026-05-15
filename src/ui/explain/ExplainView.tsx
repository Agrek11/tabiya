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
import type { ExplainBlock, Line } from '../../storage/types';
import { useExplainMode } from '../../hooks/useExplainMode';
import { useExplainTts } from '../../hooks/useExplainTts';
import { deriveHighlightStyles } from '../board/HighlightLayer';
import { ArrowLayer } from '../board/ArrowLayer';
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
};

export function ExplainView({
  line,
  blocks,
  playerColor,
  totalPlies,
  onSkipToDrill,
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

  // Overlays — only present during showOverlays. Other states render empty.
  const activeBlock: ExplainBlock | null = explain.currentBlock;
  const arrows = activeBlock?.arrows ?? [];
  const highlights = activeBlock?.highlights ?? [];

  const { squareStyles } = useMemo(
    () => deriveHighlightStyles({ mode: 'spotlight', squares: highlights }),
    [highlights],
  );

  // Last-move highlight (light green tint, matches drill's lichess style).
  const squareStylesWithLastMove = useMemo<Record<string, CSSProperties>>(() => {
    const styles: Record<string, CSSProperties> = { ...squareStyles };
    if (explain.lastMove !== null && explain.state.kind !== 'showOverlays') {
      const lastStyle: CSSProperties = { backgroundColor: 'rgba(155, 199, 0, 0.42)' };
      styles[explain.lastMove.from] = { ...lastStyle, ...(styles[explain.lastMove.from] ?? {}) };
      styles[explain.lastMove.to] = { ...lastStyle, ...(styles[explain.lastMove.to] ?? {}) };
    }
    return styles;
  }, [squareStyles, explain.lastMove, explain.state]);

  // Measure board size so ArrowLayer can size its SVG. We use a ResizeObserver
  // on the board wrapper. Default fallback 480px.
  const boardWrapperRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState<number>(480);
  useEffect(() => {
    const el = boardWrapperRef.current;
    if (el === null) return;
    if (typeof ResizeObserver === 'undefined') {
      setBoardSize(el.getBoundingClientRect().width);
      return;
    }
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) setBoardSize(w);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const progressPct = totalPlies === 0 ? 0 : ((explain.currentPly + 1) / totalPlies) * 100;
  const isComplete = explain.state.kind === 'complete' && !explain.state.skipped;

  return (
    <div
      data-testid="explain-view"
      style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}
    >
      {/* Progress bar */}
      <div
        aria-label={`Explain progress ${Math.round(progressPct)}%`}
        role="progressbar"
        aria-valuenow={Math.round(progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          height: 10,
          background: t.surfaceAlt,
          borderRadius: 999,
          overflow: 'hidden',
        }}
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

      {/* Board with overlays */}
      <div
        ref={boardWrapperRef}
        style={{ position: 'relative', width: '100%' }}
        data-testid="explain-board-wrapper"
      >
        <ChessBoardPanel
          fen={explain.fen}
          flashOverlay={null}
          boardOrientation={playerColor}
          squareStyles={squareStylesWithLastMove}
          onPieceDrop={() => false}
        />
        {explain.state.kind === 'showOverlays' && arrows.length > 0 && (
          <ArrowLayer arrows={arrows} boardSize={boardSize} isFlipped={playerColor === 'black'} />
        )}
      </div>

      {/* Completion banner OR rail */}
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
  );
}
