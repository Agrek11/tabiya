/**
 * DrillPage — v1 layout for the drill experience.
 *
 * Replaces the old `DrillView`. Visual changes per Phase 0d.1 lock:
 *   - Hero board (~600px desktop, 92vw mobile)
 *   - Title row with line-switcher dropdown (mastery % → ghost placeholder
 *     until SRS lands)
 *   - Status strip below board with Hint + Restart chips
 *   - Right rail (260px desktop, hidden mobile) with move history table
 *   - Keyboard nav: ←/→/H/R unchanged
 *
 * Phase 0d.2 deltas:
 *   - Move-history rail is collapsible (chevron in rail header). State
 *     persists to localStorage. When collapsed, a floating "Show moves" pill
 *     on the right edge re-expands.
 *   - Next-expected ply is rendered with an accent (theme brand color +
 *     bottom border) during awaiting_player state, distinct from the
 *     current-ply background highlight.
 *
 * Functional behavior: catalog-driven, wrong moves persistent, hint
 * one-shot, last-move highlights. On line completion the board freezes;
 * user must press Restart (or refresh) to retry.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { ChevronDown, ChevronLeft, ChevronRight, Lightbulb, Palette, RotateCcw, ListOrdered } from 'lucide-react';
import { useClickOutside } from '../ui/use-click-outside';
import { useDrill } from '../drill/useDrill';
import { useMoveRailCollapsed } from '../drill/use-move-rail-collapsed';
import { ChessBoardPanel } from '../ui/ChessBoardPanel';
import { useTokens } from '../theme/ThemeContext';
import { useBoardTheme } from '../theme/BoardThemeContext';
import { fonts, radius } from '../theme/tokens';
import { Card } from '../ui/primitives/Card';
import { Button } from '../ui/primitives/Button';
import { StateMessage } from '../ui/primitives/StateMessage';
import { StatusStrip } from '../ui/primitives/StatusStrip';
import { getRepository } from '../storage';
import type { Line, Opening } from '../storage/types';
import { Inbox, AlertTriangle } from 'lucide-react';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'ready'; openings: Opening[]; lines: Line[] }
  | { kind: 'error'; message: string };

function fireGrandConfetti(): void {
  // Multi-stage burst: two side cannons + a centered top-down shower with
  // mixed shapes, brand colors, and a long tail for "little grand" feel.
  const colors = ['#F4A300', '#E25822', '#FFD166', '#06D6A0', '#118AB2', '#FFFFFF'];

  const cannon = (origin: { x: number; y: number }, angle: number): void => {
    void confetti({
      particleCount: 90,
      angle,
      spread: 80,
      startVelocity: 55,
      ticks: 260,
      gravity: 0.9,
      scalar: 1.15,
      origin,
      colors,
      shapes: ['circle', 'square'],
    });
  };

  cannon({ x: 0.1, y: 0.85 }, 60);
  cannon({ x: 0.9, y: 0.85 }, 120);

  // Center shower a beat later — sustains the moment.
  window.setTimeout(() => {
    void confetti({
      particleCount: 140,
      spread: 130,
      startVelocity: 38,
      ticks: 320,
      gravity: 0.75,
      scalar: 1.3,
      origin: { x: 0.5, y: 0.2 },
      colors,
      shapes: ['circle', 'square'],
    });
  }, 180);

  // Trailing sparkle burst.
  window.setTimeout(() => {
    void confetti({
      particleCount: 60,
      spread: 100,
      startVelocity: 25,
      ticks: 220,
      gravity: 0.6,
      scalar: 0.9,
      origin: { x: 0.5, y: 0.35 },
      colors,
    });
  }, 420);
}

export function DrillPage() {
  const t = useTokens();
  const [searchParams] = useSearchParams();
  const requestedOpening = searchParams.get('opening');

  const [catalog, setCatalog] = useState<CatalogState>({ kind: 'loading' });
  const [selectedOpeningId, setSelectedOpeningId] = useState<string>('');
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [openingMenuOpen, setOpeningMenuOpen] = useState(false);
  const [boardThemeMenuOpen, setBoardThemeMenuOpen] = useState(false);

  const closeOpeningMenu = useCallback(() => setOpeningMenuOpen(false), []);
  const closeLineMenu = useCallback(() => setLineMenuOpen(false), []);
  const closeBoardThemeMenu = useCallback(() => setBoardThemeMenuOpen(false), []);

  const openingMenuRef = useClickOutside<HTMLDivElement>(openingMenuOpen, closeOpeningMenu);
  const lineMenuRef = useClickOutside<HTMLDivElement>(lineMenuOpen, closeLineMenu);
  const boardThemeMenuRef = useClickOutside<HTMLDivElement>(boardThemeMenuOpen, closeBoardThemeMenu);
  const [railCollapsed, setRailCollapsed] = useMoveRailCollapsed();
  const { themeId: boardThemeId, setThemeId: setBoardThemeId, options: boardThemeOptions } = useBoardTheme();

  // Initial catalog load.
  useEffect(() => {
    const repo = getRepository();
    let cancelled = false;
    void (async () => {
      try {
        const openings = await repo.listOpenings();
        if (cancelled) return;
        if (openings.length === 0) {
          setCatalog({ kind: 'error', message: 'Catalog is empty.' });
          return;
        }
        const startOpening =
          (requestedOpening && openings.find((o) => o.id === requestedOpening)) ?? openings[0]!;
        const lines = await repo.listLines(startOpening.id);
        if (cancelled) return;
        if (lines.length === 0) {
          setCatalog({ kind: 'error', message: 'Selected opening has no lines.' });
          return;
        }
        setCatalog({ kind: 'ready', openings, lines });
        setSelectedOpeningId(startOpening.id);
        setSelectedLineId(lines[0]!.id);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load catalog.';
        setCatalog({ kind: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedOpening]);

  // Reload lines when opening changes after initial mount.
  useEffect(() => {
    if (catalog.kind !== 'ready' || selectedOpeningId === '') return;
    if (catalog.lines.length > 0 && catalog.lines[0]!.opening_id === selectedOpeningId) return;
    const repo = getRepository();
    let cancelled = false;
    void (async () => {
      const lines = await repo.listLines(selectedOpeningId);
      if (cancelled) return;
      setCatalog((prev) => (prev.kind === 'ready' ? { ...prev, lines } : prev));
      setSelectedLineId(lines.length > 0 ? lines[0]!.id : '');
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOpeningId, catalog.kind]);

  const activeOpening: Opening | null = useMemo(() => {
    if (catalog.kind !== 'ready') return null;
    return catalog.openings.find((o) => o.id === selectedOpeningId) ?? null;
  }, [catalog, selectedOpeningId]);

  const activeLine: Line | null = useMemo(() => {
    if (catalog.kind !== 'ready') return null;
    return catalog.lines.find((l) => l.id === selectedLineId) ?? null;
  }, [catalog, selectedLineId]);

  const drillMoves: readonly string[] = useMemo(
    () => (activeLine ? activeLine.moves : []),
    [activeLine]
  );
  const drillColor: 'white' | 'black' = activeOpening?.color ?? 'black';

  const drill = useDrill(drillMoves, drillColor);
  const {
    state,
    fen,
    flashOverlay,
    statusText,
    playerColor,
    onPieceDrop,
    lastMove,
    hintSquare,
    hintTier,
    showHint,
    stepBack,
    stepForward,
    restart,
  } = drill;

  // Square highlights — lichess-style subtle green tint on last-move; tier-1
  // hint = soft pulse on from-piece; tier-2 hint = full square highlight.
  const squareStyles = useMemo<Record<string, CSSProperties>>(() => {
    const styles: Record<string, CSSProperties> = {};
    if (lastMove) {
      const lastStyle: CSSProperties = {
        backgroundColor: 'rgba(155, 199, 0, 0.42)',
      };
      styles[lastMove.from] = { ...lastStyle };
      styles[lastMove.to] = { ...lastStyle };
    }
    if (hintSquare) {
      if (hintTier === 2) {
        styles[hintSquare] = {
          ...(styles[hintSquare] ?? {}),
          backgroundColor: 'rgba(255, 90, 0, 0.60)',
          boxShadow: 'inset 0 0 0 4px rgba(255, 90, 0, 1)',
        };
      } else {
        // Tier 1: subtle pulse, no fill background.
        styles[hintSquare] = {
          ...(styles[hintSquare] ?? {}),
          animation: 'tabiya-hint-pulse 1.2s ease-in-out infinite',
        };
      }
    }
    return styles;
  }, [lastMove, hintSquare, hintTier]);

  // Keyboard.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          stepBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepForward();
          break;
        case 'r':
        case 'R':
        case 'Home':
          e.preventDefault();
          restart();
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          showHint();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stepBack, stepForward, restart, showHint]);

  // Celebration fires only on a real complete-transition with a non-empty
  // line, so the placeholder `complete` state during initial catalog load
  // (drillMoves=[]) never triggers the burst.
  const prevStateKindRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevStateKindRef.current;
    prevStateKindRef.current = state.kind;
    if (prev === 'complete') return;
    if (state.kind !== 'complete') return;
    if (drillMoves.length === 0) return;
    fireGrandConfetti();
  }, [state.kind, drillMoves.length]);

  if (catalog.kind === 'loading') {
    return <StateMessage icon={Inbox} title="Loading catalog…" />;
  }
  if (catalog.kind === 'error') {
    return (
      <StateMessage
        icon={AlertTriangle}
        iconColor={t.red}
        title="Couldn't load the catalog"
        body={catalog.message}
      />
    );
  }

  const nextIdx = state.kind === 'awaiting_player' ? state.lineIndex : undefined;
  const currentPly = 'lineIndex' in state ? (state.lineIndex as number) : drillMoves.length;

  const layoutStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: railCollapsed ? '1fr' : '1fr 280px',
    gap: 24,
    alignItems: 'flex-start',
    position: 'relative',
  };

  return (
    <div className="tabiya-drill-layout" style={layoutStyle}>
      {/* Main column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {/* Title row + line switcher */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div ref={openingMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => setOpeningMenuOpen((v) => !v)}
              aria-label="Switch opening"
              style={{
                background: openingMenuOpen ? t.surfaceAlt : 'transparent',
                border: `1px solid ${openingMenuOpen ? t.border : 'transparent'}`,
                padding: '4px 10px 4px 6px',
                marginLeft: -6,
                borderRadius: radius.chip,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: fonts.sans,
                color: t.ink,
                textAlign: 'left',
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: -0.4,
                  fontFamily: fonts.sans,
                  color: t.ink,
                }}
              >
                {activeOpening?.name ?? '—'}
              </h1>
              <ChevronDown
                size={18}
                strokeWidth={2.4}
                style={{
                  transition: 'transform 150ms',
                  transform: openingMenuOpen ? 'rotate(180deg)' : 'rotate(0)',
                  color: t.inkDim,
                }}
              />
            </button>
            {openingMenuOpen && (
              <OpeningSwitcherMenu
                openings={catalog.openings}
                selectedOpeningId={selectedOpeningId}
                onPick={(openingId) => {
                  setSelectedOpeningId(openingId);
                  setOpeningMenuOpen(false);
                }}
              />
            )}
          </div>

          <div ref={lineMenuRef} style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
            <button
              onClick={() => setLineMenuOpen((v) => !v)}
              style={{
                background: lineMenuOpen ? t.surfaceAlt : 'transparent',
                border: `1px solid ${lineMenuOpen ? t.border : 'transparent'}`,
                padding: '4px 10px 4px 8px',
                marginLeft: -8,
                borderRadius: radius.chip,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: fonts.sans,
                color: t.inkDim,
                textAlign: 'left',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span>{activeLine?.name ?? '—'}</span>
              <ChevronDown
                size={14}
                strokeWidth={2.4}
                style={{
                  transition: 'transform 150ms',
                  transform: lineMenuOpen ? 'rotate(180deg)' : 'rotate(0)',
                  color: t.inkDim,
                }}
              />
            </button>

            {lineMenuOpen && (
              <LineSwitcherMenu
                lines={catalog.lines.filter((l) => l.opening_id === selectedOpeningId)}
                selectedLineId={selectedLineId}
                onPick={(lineId) => {
                  setSelectedLineId(lineId);
                  setLineMenuOpen(false);
                }}
              />
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginTop: 8,
              gap: 12,
              alignSelf: 'stretch',
            }}
          >
            <div ref={boardThemeMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setBoardThemeMenuOpen((v) => !v)}
                aria-label="Board theme"
                style={{
                  background: boardThemeMenuOpen ? t.surfaceAlt : 'transparent',
                  border: `1px solid ${boardThemeMenuOpen ? t.border : 'transparent'}`,
                  padding: '4px 10px',
                  borderRadius: radius.chip,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: t.inkDim,
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <Palette size={14} />
                <span>Board</span>
              </button>
              {boardThemeMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: 220,
                    background: t.surface,
                    border: `1px solid ${t.border}`,
                    borderRadius: radius.card,
                    boxShadow: t.shadowMd,
                    padding: 4,
                    zIndex: 50,
                  }}
                >
                  {boardThemeOptions.map((opt) => {
                    const isSel = opt.id === boardThemeId;
                    return (
                      <button
                        key={opt.id}
                        className="tabiya-popover-item"
                        onClick={() => {
                          setBoardThemeId(opt.id);
                          setBoardThemeMenuOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 10px',
                          width: '100%',
                          ...(isSel ? { background: t.surfaceAlt } : null),
                          border: 'none',
                          borderRadius: radius.chip,
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: t.ink,
                          fontFamily: fonts.sans,
                          fontSize: 13,
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            width: 24,
                            height: 16,
                            borderRadius: 3,
                            background: `linear-gradient(to right, ${opt.light} 50%, ${opt.dark} 50%)`,
                            border: `1px solid ${t.border}`,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ flex: 1 }}>{opt.label}</span>
                        {isSel && <span style={{ color: t.brand, fontSize: 11 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hero board */}
        <Card padding={12} style={{ width: '100%' }}>
          <div style={{ width: '100%', margin: '0 auto' }}>
            <ChessBoardPanel
              fen={fen}
              flashOverlay={flashOverlay}
              boardOrientation={playerColor}
              squareStyles={squareStyles}
              onPieceDrop={onPieceDrop}
            />
          </div>
        </Card>

        {/* Status strip + actions */}
        <Card padding={14}>
          <StatusStrip
            statusText={statusText}
            stateKind={state.kind}
            ply={currentPly}
            totalPly={drillMoves.length}
          />
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <Button variant="chip" onClick={showHint} disabled={state.kind !== 'awaiting_player'}>
              <Lightbulb size={14} /> Hint
            </Button>
            <Button variant="chip" onClick={restart} disabled={!drill.canRestart}>
              <RotateCcw size={14} /> Restart
            </Button>
          </div>
          <div
            style={{
              fontSize: 11,
              color: t.inkSoft,
              textAlign: 'center',
              fontFamily: fonts.mono,
              letterSpacing: 0.3,
              marginTop: 10,
            }}
          >
            ← back · → forward · H hint · R restart
          </div>
        </Card>
      </div>

      {/* Right rail */}
      {!railCollapsed && (
        <div
          className="tabiya-drill-rail"
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <Card padding={0}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.ink,
                  fontFamily: fonts.sans,
                }}
              >
                Move history
              </div>
              <button
                onClick={() => setRailCollapsed(true)}
                aria-label="Collapse move history"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: radius.chip,
                  color: t.inkDim,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div style={{ padding: '10px 16px', maxHeight: 360, overflowY: 'auto' }}>
              <MoveHistory moves={drillMoves} state={state} nextIdx={nextIdx} />
            </div>
          </Card>
        </div>
      )}

      {/* Floating expand pill (only when collapsed) */}
      {railCollapsed && (
        <button
          onClick={() => setRailCollapsed(false)}
          aria-label="Show move history"
          style={{
            position: 'absolute',
            top: 80,
            right: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px 6px 8px',
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRight: 'none',
            borderTopLeftRadius: radius.chip,
            borderBottomLeftRadius: radius.chip,
            color: t.inkDim,
            fontFamily: fonts.sans,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: t.shadowMd,
          }}
        >
          <ChevronLeft size={14} />
          <ListOrdered size={14} />
          <span>Moves</span>
        </button>
      )}
    </div>
  );
}

function MoveHistory({
  moves,
  state,
  nextIdx,
}: {
  moves: readonly string[];
  state: { kind: string; lineIndex?: number };
  nextIdx?: number | undefined;
}) {
  const t = useTokens();
  // Number of plies actually played so far. Drives the dim → dark gradient
  // across move cells: idx < playedCount = played (dark), idx >= = upcoming
  // (dim). `complete` state has no lineIndex but means every move played.
  const playedCount =
    state.kind === 'complete'
      ? moves.length
      : 'lineIndex' in state
        ? (state.lineIndex as number)
        : 0;

  if (moves.length === 0) {
    return (
      <div style={{ fontSize: 12, color: t.inkSoft, fontFamily: fonts.sans }}>
        No moves yet.
      </div>
    );
  }

  const rows: Array<{ n: number; w: string; b?: string }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ n: Math.floor(i / 2) + 1, w: moves[i]!, b: moves[i + 1] });
  }

  const cellStyle = (idx: number): CSSProperties => {
    const isPlayed = idx < playedCount;
    const isCurrent = idx === playedCount && idx < moves.length;
    const isNext = nextIdx !== undefined && idx === nextIdx;
    return {
      fontWeight: isPlayed ? 600 : 500,
      padding: '5px 8px',
      color: isNext ? t.brand : isPlayed ? t.ink : t.inkSoft,
      background: isCurrent ? t.brandSoft : 'transparent',
      borderBottom: isNext ? `2px solid ${t.brand}` : '2px solid transparent',
      borderRadius: 4,
    };
  };

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: fonts.mono,
        fontSize: 13,
      }}
    >
      <tbody>
        {rows.map((r) => {
          const wIdx = (r.n - 1) * 2;
          const bIdx = wIdx + 1;
          return (
            <tr key={r.n}>
              <td style={{ color: t.inkSoft, fontWeight: 500, padding: '5px 0', width: 28 }}>
                {r.n}.
              </td>
              <td data-testid={`move-cell-${wIdx}`} style={cellStyle(wIdx)}>
                {r.w}
              </td>
              <td data-testid={`move-cell-${bIdx}`} style={cellStyle(bIdx)}>
                {r.b ?? ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LineSwitcherMenu({
  lines,
  selectedLineId,
  onPick,
}: {
  lines: Line[];
  selectedLineId: string;
  onPick: (lineId: string) => void;
}) {
  const t = useTokens();

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        width: 320,
        maxHeight: 440,
        overflowY: 'auto',
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: radius.card,
        boxShadow: t.shadowMd,
        padding: 6,
        zIndex: 50,
      }}
    >
      {lines.length === 0 && (
        <div style={{ padding: '10px 12px', fontSize: 12, color: t.inkSoft, fontFamily: fonts.sans }}>
          No lines yet.
        </div>
      )}
      {lines.map((line) => {
        const isCurrent = line.id === selectedLineId;
        return (
          <button
            key={line.id}
            className="tabiya-popover-item"
            onClick={() => onPick(line.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 10px',
              width: '100%',
              ...(isCurrent ? { background: t.surfaceAlt } : null),
              border: 'none',
              borderRadius: radius.chip,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: fonts.sans,
              color: t.ink,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{line.name}</div>
              <div
                style={{
                  fontSize: 11,
                  color: t.inkDim,
                  marginTop: 2,
                  fontFamily: fonts.mono,
                }}
              >
                {line.depth} ply
              </div>
            </div>
            {isCurrent && (
              <span style={{ color: t.brand, fontSize: 11 }}>✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function OpeningSwitcherMenu({
  openings,
  selectedOpeningId,
  onPick,
}: {
  openings: Opening[];
  selectedOpeningId: string;
  onPick: (openingId: string) => void;
}) {
  const t = useTokens();

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        width: 340,
        maxHeight: 440,
        overflowY: 'auto',
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: radius.card,
        boxShadow: t.shadowMd,
        padding: 6,
        zIndex: 50,
      }}
    >
      {openings.length === 0 && (
        <div style={{ padding: '10px 12px', fontSize: 12, color: t.inkSoft, fontFamily: fonts.sans }}>
          No openings yet.
        </div>
      )}
      {openings.map((o) => {
        const isCurrent = o.id === selectedOpeningId;
        return (
          <button
            key={o.id}
            className="tabiya-popover-item"
            onClick={() => onPick(o.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 10px',
              width: '100%',
              ...(isCurrent ? { background: t.surfaceAlt } : null),
              border: 'none',
              borderRadius: radius.chip,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: fonts.sans,
              color: t.ink,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{o.name}</div>
              <div
                style={{
                  fontSize: 11,
                  color: t.inkDim,
                  marginTop: 2,
                  fontFamily: fonts.mono,
                }}
              >
                {o.eco} · {o.color === 'white' ? 'White' : 'Black'}
              </div>
            </div>
            {isCurrent && (
              <span style={{ color: t.brand, fontSize: 11 }}>✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
