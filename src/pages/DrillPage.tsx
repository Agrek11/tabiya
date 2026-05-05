/**
 * DrillPage — wireframe v1.3 layout (Tue May 2026 refactor #2).
 *
 * Layout:
 *   Desktop: 2-column CSS grid `1fr 300px` with gap 24px.
 *     ┌─ MAIN ────────────────────────────────────────┐ ┌─ HISTORY ────┐
 *     │ Header row                                    │ │ Move history │
 *     │   [Opening ▼] [Line ▼]            [Mode ▼]    │ │ (sticky)     │
 *     │ Progress bar (10px)                           │ │              │
 *     │ Hero board                                    │ │              │
 *     │ Inline coach line                             │ │              │
 *     │ Action chips (Restart / Skip / Hint)          │ │              │
 *     └───────────────────────────────────────────────┘ └──────────────┘
 *   Mobile (≤880px): single column. History falls below the action chips.
 *
 * v1.3 deltas vs v1.2:
 *   - Move history moves from bottom collapsible → right-side panel
 *     (sticky on desktop, always visible). Toggle still available to collapse.
 *   - Default historyOpen = TRUE (right column has space).
 *   - Opening + Line dropdowns are now SIDE BY SIDE, both pill-styled.
 *   - "Slick" dropdown design: pill trigger, surfaceAlt fill, big-bold name,
 *     items have radio-circle indicator (○ / ●), current item in t.brand.
 *   - Items show name only (ECO + ply moved into trigger caption).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Eye,
  Inbox,
  Lightbulb,
  RotateCcw,
  Search,
  SkipForward,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import { useClickOutside } from '../ui/use-click-outside';
import { useDrill } from '../drill/useDrill';
import { useDrillHistoryOpen } from '../drill/use-drill-history-open';
import { ChessBoardPanel } from '../ui/ChessBoardPanel';
import { useTokens } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { StateMessage } from '../ui/primitives/StateMessage';
import { getRepository } from '../storage';
import type { Line, Opening } from '../storage/types';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'ready'; openings: Opening[]; lines: Line[] }
  | { kind: 'error'; message: string };

type ModeId = 'theory' | 'coach' | 'visualizer' | 'engine';

type ModeOption = {
  id: ModeId;
  label: string;
  icon: typeof BookOpen;
  available: boolean;
};

const MODES: ModeOption[] = [
  { id: 'theory', label: 'Theory', icon: BookOpen, available: true },
  { id: 'coach', label: 'AI Coach', icon: Sparkles, available: false },
  { id: 'visualizer', label: 'Visualizer', icon: Eye, available: false },
  { id: 'engine', label: 'Play it out', icon: Swords, available: false },
];

const PROGRESS_BAR_HEIGHT = 10;
const HISTORY_RAIL_WIDTH = 300;

function fireGrandConfetti(): void {
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
  const [openingMenuOpen, setOpeningMenuOpen] = useState(false);
  const [openingSearch, setOpeningSearch] = useState('');
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [lineSearch, setLineSearch] = useState('');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<ModeId>('theory');
  const [historyOpen, setHistoryOpen] = useDrillHistoryOpen();
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const closeOpeningMenu = useCallback(() => {
    setOpeningMenuOpen(false);
    setOpeningSearch('');
  }, []);
  const closeLineMenu = useCallback(() => {
    setLineMenuOpen(false);
    setLineSearch('');
  }, []);
  const closeModeMenu = useCallback(() => setModeMenuOpen(false), []);
  const openingMenuRef = useClickOutside<HTMLDivElement>(openingMenuOpen, closeOpeningMenu);
  const lineMenuRef = useClickOutside<HTMLDivElement>(lineMenuOpen, closeLineMenu);
  const modeMenuRef = useClickOutside<HTMLDivElement>(modeMenuOpen, closeModeMenu);

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

  // Load lines when opening changes.
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
    legalMovesFrom,
  } = drill;

  // Click-to-move state.
  const legalDestSquares = useMemo<string[]>(() => {
    if (!selectedSquare) return [];
    return legalMovesFrom(selectedSquare);
  }, [selectedSquare, legalMovesFrom]);

  useEffect(() => {
    setSelectedSquare(null);
  }, [state, drillMoves]);

  const onPieceClick = useCallback(
    ({ square }: { piece: unknown; square: string | null }) => {
      if (state.kind !== 'awaiting_player') return;
      if (!square) return;
      const moves = legalMovesFrom(square);
      if (moves.length > 0) {
        setSelectedSquare(square);
      } else if (square === selectedSquare) {
        setSelectedSquare(null);
      }
    },
    [state, legalMovesFrom, selectedSquare]
  );

  const onSquareClick = useCallback(
    ({ square }: { piece: unknown; square: string }) => {
      if (state.kind !== 'awaiting_player') return;
      if (!selectedSquare) return;
      if (square === selectedSquare) {
        setSelectedSquare(null);
        return;
      }
      if (legalDestSquares.includes(square)) {
        const ok = onPieceDrop({ sourceSquare: selectedSquare, targetSquare: square });
        setSelectedSquare(null);
        void ok;
      }
    },
    [state, selectedSquare, legalDestSquares, onPieceDrop]
  );

  const squareStyles = useMemo<Record<string, CSSProperties>>(() => {
    const styles: Record<string, CSSProperties> = {};
    if (lastMove) {
      const lastStyle: CSSProperties = { backgroundColor: 'rgba(155, 199, 0, 0.42)' };
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
        case 'Escape':
          e.preventDefault();
          setSelectedSquare(null);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stepBack, stepForward, restart, showHint]);

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
  const totalPly = drillMoves.length;
  const progressPct = totalPly === 0 ? 0 : (currentPly / totalPly) * 100;

  const linesForOpening = catalog.lines.filter((l) => l.opening_id === selectedOpeningId);
  const filteredLines = filterLines(linesForOpening, lineSearch);
  const filteredOpenings = filterOpenings(catalog.openings, openingSearch);

  const currentMode = MODES.find((m) => m.id === activeMode) ?? MODES[0]!;
  const ModeIcon = currentMode.icon;

  const ghostBtnStyle: CSSProperties = {
    background: 'transparent',
    border: `1px solid ${t.border}`,
    borderRadius: 999,
    padding: '8px 16px',
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: 500,
    color: t.ink,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  };

  return (
    <div
      className="tabiya-drill-layout"
      style={{
        display: 'grid',
        gridTemplateColumns: `1fr ${HISTORY_RAIL_WIDTH}px`,
        gap: 24,
        alignItems: 'start',
        maxWidth: 1180,
        margin: '0 auto',
      }}
    >
      {/* MAIN COLUMN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        {/* HEADER ROW: opening + line side-by-side, mode right-aligned */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 0,
              flex: 1,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: t.inkSoft,
                fontWeight: 600,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                fontFamily: fonts.sans,
              }}
            >
              Repertoire
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {/* Opening pill */}
              <div ref={openingMenuRef} style={{ position: 'relative' }}>
                <PillTrigger
                  label={activeOpening?.name ?? '—'}
                  open={openingMenuOpen}
                  onClick={() => setOpeningMenuOpen((v) => !v)}
                  ariaLabel="Switch opening"
                  prominent
                />
                {openingMenuOpen && (
                  <SlickMenu
                    placeholder={`Search ${catalog.openings.length} opening${catalog.openings.length === 1 ? '' : 's'}…`}
                    searchValue={openingSearch}
                    onSearch={setOpeningSearch}
                    items={filteredOpenings.map((o) => ({
                      key: o.id,
                      label: o.name,
                      isCurrent: o.id === selectedOpeningId,
                      onPick: () => {
                        setSelectedOpeningId(o.id);
                        closeOpeningMenu();
                      },
                    }))}
                    emptyHint={
                      openingSearch.trim()
                        ? `No openings match "${openingSearch}"`
                        : 'No openings yet.'
                    }
                  />
                )}
              </div>

              {/* Line pill */}
              <div ref={lineMenuRef} style={{ position: 'relative' }}>
                <PillTrigger
                  label={activeLine?.name ?? '—'}
                  open={lineMenuOpen}
                  onClick={() => setLineMenuOpen((v) => !v)}
                  ariaLabel="Switch line"
                />
                {lineMenuOpen && (
                  <SlickMenu
                    placeholder={`Search ${linesForOpening.length} line${linesForOpening.length === 1 ? '' : 's'}…`}
                    searchValue={lineSearch}
                    onSearch={setLineSearch}
                    items={filteredLines.map((line) => ({
                      key: line.id,
                      label: line.name,
                      isCurrent: line.id === selectedLineId,
                      onPick: () => {
                        setSelectedLineId(line.id);
                        closeLineMenu();
                      },
                    }))}
                    emptyHint={
                      lineSearch.trim() ? `No lines match "${lineSearch}"` : 'No lines yet.'
                    }
                  />
                )}
              </div>
            </div>
          </div>

          {/* Mode dropdown */}
          <div ref={modeMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setModeMenuOpen((v) => !v)}
              aria-label="Switch mode"
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 999,
                padding: '8px 14px',
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: 500,
                color: t.ink,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ModeIcon size={14} color={t.brand} strokeWidth={2.2} />
              {currentMode.label}
              <ChevronDown
                size={14}
                style={{
                  transition: 'transform 150ms',
                  transform: modeMenuOpen ? 'rotate(180deg)' : 'rotate(0)',
                  color: t.inkDim,
                }}
              />
            </button>
            {modeMenuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: 240,
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: radius.card,
                  boxShadow: t.shadowMd,
                  padding: 6,
                  zIndex: 50,
                }}
              >
                {MODES.map((m) => {
                  const Icon = m.icon;
                  const isActive = m.id === activeMode;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (m.available) {
                          setActiveMode(m.id);
                          setModeMenuOpen(false);
                        }
                      }}
                      disabled={!m.available}
                      className="tabiya-popover-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        width: '100%',
                        background: isActive ? t.brandSoft : 'transparent',
                        border: 'none',
                        borderRadius: radius.chip,
                        cursor: m.available ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        fontFamily: fonts.sans,
                        fontSize: 13.5,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? t.brand : m.available ? t.ink : t.inkSoft,
                        opacity: m.available ? 1 : 0.7,
                      }}
                    >
                      <Icon size={15} strokeWidth={isActive ? 2.4 : 2} />
                      <span style={{ flex: 1 }}>{m.label}</span>
                      {!m.available && (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            background: t.surfaceAlt,
                            color: t.inkSoft,
                            padding: '1px 6px',
                            borderRadius: 999,
                            letterSpacing: 0.4,
                            textTransform: 'uppercase',
                          }}
                        >
                          Soon
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div>
          <div
            aria-label={`Drill progress ${Math.round(progressPct)}%`}
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{
              height: PROGRESS_BAR_HEIGHT,
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
        </div>

        {/* HERO BOARD */}
        <div style={{ width: '100%' }}>
          <ChessBoardPanel
            fen={fen}
            flashOverlay={flashOverlay}
            boardOrientation={playerColor}
            squareStyles={squareStyles}
            onPieceDrop={onPieceDrop}
            selectedSquare={selectedSquare}
            legalDestSquares={legalDestSquares}
            onPieceClick={onPieceClick}
            onSquareClick={onSquareClick}
          />
        </div>

        {/* INLINE COACH LINE */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '4px 12px',
          }}
        >
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: t.brandSoft,
              color: t.brand,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 15,
            }}
          >
            ♞
          </div>
          <div style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>{statusText}</div>
        </div>

        {/* ACTION CHIPS */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={restart}
            disabled={!drill.canRestart}
            style={{
              ...ghostBtnStyle,
              opacity: drill.canRestart ? 1 : 0.5,
              cursor: drill.canRestart ? 'pointer' : 'not-allowed',
            }}
          >
            <RotateCcw size={14} /> Restart
          </button>
          <button
            onClick={stepForward}
            disabled={!drill.canStepForward}
            style={{
              ...ghostBtnStyle,
              opacity: drill.canStepForward ? 1 : 0.5,
              cursor: drill.canStepForward ? 'pointer' : 'not-allowed',
            }}
          >
            <SkipForward size={14} /> Skip
          </button>
          <button
            onClick={showHint}
            disabled={state.kind !== 'awaiting_player'}
            style={{
              ...ghostBtnStyle,
              opacity: state.kind === 'awaiting_player' ? 1 : 0.5,
              cursor: state.kind === 'awaiting_player' ? 'pointer' : 'not-allowed',
            }}
          >
            <Lightbulb size={14} /> Hint
          </button>
        </div>
      </div>

      {/* RIGHT RAIL — MOVE HISTORY */}
      <aside
        className="tabiya-drill-rail"
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: radius.card,
          padding: 0,
          alignSelf: 'start',
          position: 'sticky',
          top: 80,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setHistoryOpen(!historyOpen)}
          aria-label="Toggle move history"
          aria-expanded={historyOpen}
          style={{
            background: 'transparent',
            border: 'none',
            width: '100%',
            padding: '12px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: fonts.sans,
            fontSize: 13,
            fontWeight: 600,
            color: t.ink,
            textAlign: 'left',
            borderBottom: historyOpen ? `1px solid ${t.border}` : 'none',
          }}
        >
          <ChevronDown
            size={14}
            style={{
              transition: 'transform 150ms',
              transform: historyOpen ? 'rotate(0)' : 'rotate(-90deg)',
              color: t.inkDim,
            }}
          />
          Move history
          <span style={{ color: t.inkSoft, fontFamily: fonts.mono, fontWeight: 500 }}>
            ({drillMoves.length})
          </span>
        </button>
        {historyOpen && (
          <div style={{ padding: '8px 8px 12px', maxHeight: 540, overflowY: 'auto' }}>
            <MoveHistoryGrid
              moves={drillMoves}
              playedCount={
                state.kind === 'complete'
                  ? drillMoves.length
                  : 'lineIndex' in state
                    ? (state.lineIndex as number)
                    : 0
              }
              nextIdx={nextIdx}
            />
          </div>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PillTrigger — slick rounded button used as dropdown trigger
// ---------------------------------------------------------------------------

function PillTrigger({
  label,
  caption,
  open,
  onClick,
  ariaLabel,
  prominent = false,
}: {
  label: string;
  caption?: string;
  open: boolean;
  onClick: () => void;
  ariaLabel: string;
  prominent?: boolean;
}) {
  const t = useTokens();
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={open}
      style={{
        background: open ? t.surfaceAlt : t.surface,
        border: `1px solid ${open ? t.borderStrong : t.border}`,
        borderRadius: 999,
        padding: prominent ? '8px 16px 8px 18px' : '7px 14px 7px 16px',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: fonts.sans,
        color: t.ink,
        transition: 'background 120ms ease, border-color 120ms ease',
        boxShadow: open ? t.shadow : 'none',
      }}
    >
      <span
        style={{
          fontSize: prominent ? 17 : 14,
          fontWeight: 700,
          letterSpacing: prominent ? -0.3 : -0.1,
          color: t.ink,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {caption && (
        <span
          style={{
            fontSize: 11,
            color: t.inkSoft,
            fontFamily: fonts.mono,
            fontWeight: 500,
            letterSpacing: 0.2,
          }}
        >
          {caption}
        </span>
      )}
      <ChevronDown
        size={prominent ? 16 : 14}
        strokeWidth={2.4}
        style={{
          transition: 'transform 150ms',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          color: t.inkDim,
          marginLeft: 2,
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// SlickMenu — search input + radio-circle items, current = brand
// ---------------------------------------------------------------------------

function SlickMenu({
  placeholder,
  searchValue,
  onSearch,
  items,
  emptyHint,
}: {
  placeholder: string;
  searchValue: string;
  onSearch: (v: string) => void;
  items: ReadonlyArray<{ key: string; label: string; isCurrent: boolean; onPick: () => void }>;
  emptyHint: string;
}) {
  const t = useTokens();
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        width: 320,
        maxHeight: 480,
        overflowY: 'auto',
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        boxShadow: t.shadowMd,
        padding: 6,
        zIndex: 60,
      }}
    >
      <div style={{ padding: 6, marginBottom: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: t.surfaceAlt,
            borderRadius: 10,
            padding: '7px 11px',
          }}
        >
          <Search size={13} color={t.inkDim} />
          <input
            autoFocus
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              flex: 1,
              fontFamily: fonts.sans,
              fontSize: 13,
              color: t.ink,
              minWidth: 0,
            }}
          />
          {searchValue && (
            <button
              onClick={() => onSearch('')}
              aria-label="Clear search"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                color: t.inkSoft,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: '20px 12px',
            textAlign: 'center',
            fontSize: 13,
            color: t.inkDim,
            fontFamily: fonts.sans,
          }}
        >
          {emptyHint}
        </div>
      ) : (
        items.map((it) => (
          <button
            key={it.key}
            onClick={it.onPick}
            className="tabiya-popover-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 12px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: fonts.sans,
              color: it.isCurrent ? t.brand : t.ink,
              fontWeight: it.isCurrent ? 700 : 500,
              fontSize: 14.5,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `2px solid ${it.isCurrent ? t.brand : t.border}`,
                background: it.isCurrent ? t.brand : 'transparent',
                flexShrink: 0,
                position: 'relative',
                boxShadow: it.isCurrent ? `inset 0 0 0 2px ${t.surface}` : 'none',
              }}
            />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.label}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterOpenings(openings: readonly Opening[], q: string): Opening[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [...openings];
  return openings.filter(
    (o) =>
      o.name.toLowerCase().includes(needle) ||
      o.eco.toLowerCase().includes(needle) ||
      o.color.toLowerCase().includes(needle)
  );
}

function filterLines(lines: readonly Line[], q: string): Line[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [...lines];
  return lines.filter((l) => l.name.toLowerCase().includes(needle));
}

function MoveHistoryGrid({
  moves,
  playedCount,
  nextIdx,
}: {
  moves: readonly string[];
  playedCount: number;
  nextIdx?: number | undefined;
}) {
  const t = useTokens();

  if (moves.length === 0) {
    return (
      <div
        style={{
          padding: '8px 4px 12px',
          fontSize: 12,
          color: t.inkSoft,
          fontFamily: fonts.sans,
        }}
      >
        No moves yet.
      </div>
    );
  }

  const rows: Array<{ n: number; wIdx: number; bIdx: number | null }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      n: Math.floor(i / 2) + 1,
      wIdx: i,
      bIdx: i + 1 < moves.length ? i + 1 : null,
    });
  }

  const cellStyle = (idx: number): CSSProperties => {
    const isPlayed = idx < playedCount;
    const isCurrent = idx === playedCount && idx < moves.length;
    const isNext = nextIdx !== undefined && idx === nextIdx;
    return {
      fontWeight: isPlayed ? 600 : 500,
      padding: '4px 8px',
      color: isNext ? t.brand : isPlayed ? t.ink : t.inkSoft,
      background: isCurrent ? t.brandSoft : 'transparent',
      borderBottom: isNext ? `2px solid ${t.brand}` : '2px solid transparent',
      borderRadius: 4,
      fontFamily: fonts.mono,
      fontSize: 13,
      textAlign: 'left',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    };
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(28px, auto) 1fr 1fr',
        rowGap: 4,
        columnGap: 8,
        maxWidth: '100%',
      }}
    >
      {rows.map((r) => (
        <div key={r.n} style={{ display: 'contents' }}>
          <div
            style={{
              color: t.inkSoft,
              fontWeight: 500,
              padding: '4px 0',
              fontFamily: fonts.mono,
              fontSize: 13,
            }}
          >
            {r.n}.
          </div>
          <div data-testid={`move-cell-${r.wIdx}`} style={cellStyle(r.wIdx)}>
            {moves[r.wIdx]}
          </div>
          {r.bIdx !== null ? (
            <div data-testid={`move-cell-${r.bIdx}`} style={cellStyle(r.bIdx)}>
              {moves[r.bIdx]}
            </div>
          ) : (
            <div />
          )}
        </div>
      ))}
    </div>
  );
}
