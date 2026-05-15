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
import { Link, useSearchParams } from 'react-router-dom';
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
import { useSRS } from '../hooks/useSRS';
import { useEventEmitter } from '../hooks/useEventEmitter';
import { useEffectivePick } from '../hooks/useEffectivePick';
import { useDrillHistoryOpen } from '../drill/use-drill-history-open';
import { useExplainContent } from '../hooks/useExplainContent';
import { useLinePrefMode } from '../hooks/useLinePrefMode';
import { ModeToggle } from '../ui/ModeToggle';
import { ExplainView } from '../ui/explain/ExplainView';
import { ChessBoardPanel } from '../ui/ChessBoardPanel';
import { useTokens } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { StateMessage } from '../ui/primitives/StateMessage';
import { StrategicNotesPanel } from '../ui/StrategicNotesPanel';
import { EndOfLineSummary } from '../ui/EndOfLineSummary';
import { getRepository, getSrsRepository } from '../storage';
import type { Family, ForkAnnotation, Line, Opening } from '../storage/types';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'ready'; openings: Opening[]; lines: Line[]; families: Family[] }
  | { kind: 'error'; message: string };

type QueueState =
  | { kind: 'off' }
  | { kind: 'active'; lineIds: string[]; index: number }
  | { kind: 'exhausted'; total: number };

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
  // Two URL conventions accepted:
  //   ?line=<line-id>     — direct line deep link (preferred from Repertoire)
  //   ?opening=<id>       — legacy: id of an Opening (synthesized 1:1 from a
  //                         Variation today). Resolves to that Opening's first
  //                         line.
  const requestedLine = searchParams.get('line');
  const requestedOpening = searchParams.get('opening');
  const requestedQueue = searchParams.get('queue');

  const [catalog, setCatalog] = useState<CatalogState>({ kind: 'loading' });
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [queueState, setQueueState] = useState<QueueState>({ kind: 'off' });
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
        const [openings, families] = await Promise.all([
          repo.listOpenings(),
          repo.listFamilies(),
        ]);
        if (cancelled) return;
        if (openings.length === 0) {
          setCatalog({ kind: 'error', message: 'Catalog is empty.' });
          return;
        }
        // Load lines for ALL openings up-front. Catalog is small (≤300 lines)
        // and JsonOpeningRepository caches the parsed catalog, so this is a
        // few in-memory filters, not N fetches.
        const allLineLists = await Promise.all(openings.map((o) => repo.listLines(o.id)));
        const lines = allLineLists.flat();
        if (cancelled) return;

        // Resolve URL → starting line. Priority:
        //   1. ?line=<line-id>            (preferred)
        //   2. ?opening=<opening-id>      (legacy: first line of that opening)
        //   3. first line of first family with content
        let startLine: Line | null = null;
        if (requestedLine) {
          startLine = lines.find((l) => l.id === requestedLine) ?? null;
        }
        if (startLine === null && requestedOpening) {
          startLine = lines.find((l) => l.opening_id === requestedOpening) ?? null;
        }
        if (startLine === null) {
          startLine = lines[0] ?? null;
        }
        if (startLine === null) {
          setCatalog({ kind: 'error', message: 'Catalog has no lines.' });
          return;
        }
        const startOpening = openings.find((o) => o.id === startLine!.opening_id);
        const startFamilyId = startOpening?.family_id ?? '';

        setCatalog({ kind: 'ready', openings, lines, families });
        setSelectedFamilyId(startFamilyId);
        setSelectedLineId(startLine.id);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load catalog.';
        setCatalog({ kind: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestedLine, requestedOpening]);

  // SRS hook — used for queue mode + the existing wiring.
  const { dueLineIds, loading: srsLoading } = useSRS();
  const { effective } = useEffectivePick();

  // Queue mode initialization. Triggered when:
  //   1. URL has `?queue=due`
  //   2. Catalog is ready
  //   3. SRS hook has finished loading
  // Snapshots dueLineIds at activation so a Box transition mid-session doesn't
  // reorder remaining drills.
  useEffect(() => {
    if (requestedQueue !== 'due') return;
    if (catalog.kind !== 'ready') return;
    if (srsLoading) return;
    if (queueState.kind !== 'off') return; // already initialized
    if (dueLineIds.length === 0) {
      setQueueState({ kind: 'exhausted', total: 0 });
      return;
    }
    // Filter to lines that actually exist in the loaded catalog (orphan
    // protection per Article 6 — old SrsState may reference removed lines)
    // AND that pass the effective repertoire pick filter (R5.9 — `?queue=due`
    // only routes drillable picks).
    const valid = dueLineIds
      .filter((id) => catalog.lines.some((l) => l.id === id))
      .filter((id) => !effective.isFiltered || effective.lineIds.has(id));
    if (valid.length === 0) {
      setQueueState({ kind: 'exhausted', total: 0 });
      return;
    }
    setQueueState({ kind: 'active', lineIds: valid, index: 0 });
    // Set the first line as the active drill.
    setSelectedLineId(valid[0]!);
    const firstLine = catalog.lines.find((l) => l.id === valid[0]);
    const firstOpening = firstLine ? catalog.openings.find((o) => o.id === firstLine.opening_id) : undefined;
    if (firstOpening) setSelectedFamilyId(firstOpening.family_id);
  }, [requestedQueue, catalog, srsLoading, dueLineIds, queueState.kind, effective]);

  // When the selected family changes, point the line picker at that family's
  // first line. No fetch needed — all lines already loaded above.
  useEffect(() => {
    if (catalog.kind !== 'ready' || selectedFamilyId === '') return;
    const familyOpeningIds = new Set(
      catalog.openings.filter((o) => o.family_id === selectedFamilyId).map((o) => o.id)
    );
    const linesForFam = catalog.lines.filter((l) => familyOpeningIds.has(l.opening_id));
    if (linesForFam.length === 0) {
      setSelectedLineId('');
      return;
    }
    if (!linesForFam.some((l) => l.id === selectedLineId)) {
      setSelectedLineId(linesForFam[0]!.id);
    }
  }, [selectedFamilyId, catalog, selectedLineId]);

  const activeLine: Line | null = useMemo(() => {
    if (catalog.kind !== 'ready') return null;
    return catalog.lines.find((l) => l.id === selectedLineId) ?? null;
  }, [catalog, selectedLineId]);

  const activeOpening: Opening | null = useMemo(() => {
    if (catalog.kind !== 'ready' || activeLine === null) return null;
    return catalog.openings.find((o) => o.id === activeLine.opening_id) ?? null;
  }, [catalog, activeLine]);

  const activeFamily: Family | null = useMemo(() => {
    if (catalog.kind !== 'ready' || activeOpening === null) return null;
    return catalog.families.find((f) => f.id === activeOpening.family_id) ?? null;
  }, [catalog, activeOpening]);

  const drillMoves: readonly string[] = useMemo(
    () => (activeLine ? activeLine.moves : []),
    [activeLine]
  );
  const drillColor: 'white' | 'black' = activeOpening?.color ?? 'black';

  // Phase 1b — Explain Mode wiring. The sidecar fetcher and per-line mode pref
  // hook both run regardless of mode (they're cheap; React 19 batching).
  // ModeToggle renders only when the sidecar is loaded; flipping the toggle
  // re-mounts the active view via differing React keys so chess.js instances
  // never leak across modes.
  const activeLineId: string | null = activeLine?.id ?? null;
  const explainContent = useExplainContent({
    lineId: activeLineId,
    expectedLength: drillMoves.length,
  });
  const [explainMode, setExplainMode] = useLinePrefMode(activeLineId);

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
    drillResult,
  } = drill;

  // Phase 1.5 — Session-event telemetry.
  // The hook owns `line_start` (on activation) and `line_abandoned` (on
  // cleanup if not completed); the page emits move_* / hint_used / line_complete
  // via the state-transition observer below.
  const { emit: emitEvent } = useEventEmitter(activeLineId);
  const prevDrillStateKindRef = useRef<string | null>(null);
  const completeEmittedForRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevDrillStateKindRef.current;
    prevDrillStateKindRef.current = state.kind;
    if (activeLine === null) return;

    // awaiting_player → flash_correct: the just-submitted ply is (new.lineIndex - 1).
    if (
      prev === 'awaiting_player' &&
      state.kind === 'flash_correct' &&
      'lineIndex' in state
    ) {
      emitEvent('move_correct', state.lineIndex - 1);
      return;
    }
    // awaiting_player → wrong_pending: the wrong ply is wrong_pending.lineIndex.
    if (
      prev === 'awaiting_player' &&
      state.kind === 'wrong_pending' &&
      'lineIndex' in state
    ) {
      emitEvent('move_wrong', state.lineIndex);
      return;
    }
    // any → complete: emit line_complete once per active line.
    if (state.kind === 'complete' && completeEmittedForRef.current !== activeLine.id) {
      completeEmittedForRef.current = activeLine.id;
      emitEvent('line_complete', Math.max(0, drillMoves.length - 1));
    }
  }, [state, activeLine, drillMoves.length, emitEvent]);

  // Reset the completion-emitted guard whenever the active line changes.
  useEffect(() => {
    completeEmittedForRef.current = null;
  }, [activeLineId]);

  // Hint button wraps showHint with a hint_used emission. Forwards to the
  // underlying handler unchanged.
  const showHintWithEmit = useCallback((): void => {
    if (activeLine !== null && 'lineIndex' in state) {
      emitEvent('hint_used', (state as { lineIndex: number }).lineIndex);
    }
    showHint();
  }, [activeLine, state, showHint, emitEvent]);

  // Phase 1 — SRS write on drill completion.
  // Fire-and-forget. Guarded by a ref so a re-render after the effect doesn't
  // double-write. Cleared whenever the active line changes.
  const srsRecordedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeLine === null) return;
    if (srsRecordedForRef.current === activeLine.id) return;
    if (drillResult === null) return;
    if (state.kind !== 'complete') return;
    srsRecordedForRef.current = activeLine.id;
    getSrsRepository()
      .recordDrillResult(activeLine.id, drillResult)
      .catch((err) => console.error('SRS write failed:', err));
  }, [drillResult, state, activeLine]);

  useEffect(() => {
    srsRecordedForRef.current = null;
  }, [activeLine]);

  // Queue advance on completion. Decoupled from SRS write so timing is
  // straightforward: when a line finishes in queue mode, advance OR exhaust.
  useEffect(() => {
    if (state.kind !== 'complete') return;
    if (queueState.kind !== 'active') return;
    if (catalog.kind !== 'ready') return;
    if (activeLine === null) return;
    // Only advance if the just-completed line is the current queue position.
    const currentLineId = queueState.lineIds[queueState.index];
    if (currentLineId !== activeLine.id) return;
    const nextIndex = queueState.index + 1;
    if (nextIndex >= queueState.lineIds.length) {
      setQueueState({ kind: 'exhausted', total: queueState.lineIds.length });
      return;
    }
    // Small delay so user sees "complete" flash before next line loads.
    const id = window.setTimeout(() => {
      const nextLineId = queueState.lineIds[nextIndex]!;
      const nextLine = catalog.lines.find((l) => l.id === nextLineId);
      const nextOpening = nextLine ? catalog.openings.find((o) => o.id === nextLine.opening_id) : undefined;
      setQueueState({ ...queueState, index: nextIndex });
      setSelectedLineId(nextLineId);
      if (nextOpening) setSelectedFamilyId(nextOpening.family_id);
    }, 800);
    return () => window.clearTimeout(id);
  }, [state, queueState, catalog, activeLine]);

  // Exit queue when user manually picks a different line/family.
  const exitQueue = useCallback(() => {
    if (queueState.kind !== 'off') setQueueState({ kind: 'off' });
  }, [queueState.kind]);

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
          showHintWithEmit();
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedSquare(null);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stepBack, stepForward, restart, showHintWithEmit]);

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
  if (queueState.kind === 'exhausted') {
    return (
      <StateMessage
        icon={Inbox}
        title="All caught up"
        body={
          queueState.total === 0
            ? "Nothing's due right now. Drill any line to seed your queue."
            : `${queueState.total} line${queueState.total === 1 ? '' : 's'} drilled. Come back tomorrow.`
        }
        action={
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: t.brand,
                color: '#fff',
                border: 'none',
                padding: '10px 18px',
                borderRadius: 8,
                fontFamily: fonts.sans,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to Dashboard
            </button>
          </Link>
        }
      />
    );
  }

  const nextIdx = state.kind === 'awaiting_player' ? state.lineIndex : undefined;
  const currentPly = 'lineIndex' in state ? (state.lineIndex as number) : drillMoves.length;
  const totalPly = drillMoves.length;
  const progressPct = totalPly === 0 ? 0 : (currentPly / totalPly) * 100;

  const familyOpeningIds = new Set(
    catalog.openings.filter((o) => o.family_id === selectedFamilyId).map((o) => o.id)
  );
  const linesForFamily = catalog.lines
    .filter((l) => familyOpeningIds.has(l.opening_id))
    .filter((l) => !effective.isFiltered || effective.lineIds.has(l.id));
  const filteredLines = filterLines(linesForFamily, lineSearch);
  const familiesWithLines = catalog.families
    .filter((f) =>
      catalog.lines.some((l) => {
        const op = catalog.openings.find((o) => o.id === l.opening_id);
        return op?.family_id === f.id;
      })
    )
    .filter((f) => {
      if (!effective.isFiltered) return true;
      return catalog.lines.some((l) => {
        const op = catalog.openings.find((o) => o.id === l.opening_id);
        return op?.family_id === f.id && effective.lineIds.has(l.id);
      });
    });
  const filteredFamilies = filterFamilies(familiesWithLines, openingSearch);

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
              {queueState.kind === 'active' && (
                <button
                  onClick={exitQueue}
                  title="Exit queue mode"
                  style={{
                    marginLeft: 8,
                    padding: '2px 8px',
                    background: t.brandSoft,
                    color: t.brand,
                    border: 'none',
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontFamily: fonts.sans,
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  Queue {queueState.index + 1}/{queueState.lineIds.length} ✕
                </button>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {/* Opening (= Family) pill */}
              <div ref={openingMenuRef} style={{ position: 'relative' }}>
                <PillTrigger
                  label={activeFamily?.name ?? '—'}
                  open={openingMenuOpen}
                  onClick={() => setOpeningMenuOpen((v) => !v)}
                  ariaLabel="Switch opening"
                  prominent
                />
                {openingMenuOpen && (
                  <SlickMenu
                    placeholder={`Search ${familiesWithLines.length} opening${familiesWithLines.length === 1 ? '' : 's'}…`}
                    searchValue={openingSearch}
                    onSearch={setOpeningSearch}
                    items={filteredFamilies.map((f) => ({
                      kind: 'item' as const,
                      key: f.id,
                      label: f.name,
                      isCurrent: f.id === selectedFamilyId,
                      onPick: () => {
                        setSelectedFamilyId(f.id);
                        closeOpeningMenu();
                        exitQueue();
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

              {/* Line pill — grouped by Variation under the active family */}
              <div ref={lineMenuRef} style={{ position: 'relative' }}>
                <PillTrigger
                  label={activeLine?.name ?? '—'}
                  open={lineMenuOpen}
                  onClick={() => setLineMenuOpen((v) => !v)}
                  ariaLabel="Switch line"
                />
                {lineMenuOpen && (
                  <SlickMenu
                    placeholder={`Search ${linesForFamily.length} line${linesForFamily.length === 1 ? '' : 's'}…`}
                    searchValue={lineSearch}
                    onSearch={setLineSearch}
                    items={buildGroupedLineItems({
                      lines: filteredLines,
                      openings: catalog.openings,
                      selectedLineId,
                      onPick: (id) => {
                        setSelectedLineId(id);
                        closeLineMenu();
                        exitQueue();
                      },
                    })}
                    emptyHint={
                      lineSearch.trim() ? `No lines match "${lineSearch}"` : 'No lines yet.'
                    }
                  />
                )}
              </div>
            </div>
          </div>

          {/* Phase 1b — Drill/Explain toggle. Hidden when sidecar is missing or
              not yet authored for this line (graceful degrade per R1 AC #4). */}
          {(explainContent.kind === 'loaded' || explainContent.kind === 'loading') && (
            <div style={{ flexShrink: 0 }}>
              <ModeToggle
                value={explainMode}
                onChange={setExplainMode}
                disabled={explainContent.kind === 'loading'}
              />
            </div>
          )}

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

        {/* Phase 1b — Explain Mode branch. Renders the explain view (with its
            own progress bar + board + rail) in place of the drill UI when the
            sidecar is loaded AND the per-line pref is "explain". Unique
            React key ensures the chess.js instance under useExplainMode never
            leaks across mode switches. */}
        {explainMode === 'explain' &&
        explainContent.kind === 'loaded' &&
        activeLine !== null ? (
          <ExplainView
            key={`explain-${activeLine.id}`}
            line={activeLine}
            blocks={explainContent.data}
            playerColor={drillColor}
            totalPlies={drillMoves.length}
            onSkipToDrill={() => setExplainMode('drill')}
          />
        ) : (
          <>
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

        {/* END-OF-LINE SUMMARY (non-queue mode) */}
        {state.kind === 'complete' &&
          queueState.kind !== 'active' &&
          activeLine !== null &&
          drillResult !== null && (
            <EndOfLineSummary
              line={activeLine}
              drillResult={drillResult}
              dueCount={dueLineIds.length}
              nextLineInFamily={(() => {
                if (catalog.kind !== 'ready' || activeFamily === null) return null;
                const familyOpIds = new Set(
                  catalog.openings.filter((o) => o.family_id === activeFamily.id).map((o) => o.id)
                );
                const famLines = catalog.lines.filter((l) => familyOpIds.has(l.opening_id));
                const idx = famLines.findIndex((l) => l.id === activeLine.id);
                return idx >= 0 && idx + 1 < famLines.length ? famLines[idx + 1]! : null;
              })()}
              onRestart={restart}
              onPickLine={(id) => setSelectedLineId(id)}
            />
          )}

        {/* STRATEGY PANEL */}
        <StrategicNotesPanel notes={activeLine?.strategic_notes ?? []} />

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
            onClick={showHintWithEmit}
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
          </>
        )}
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
              forks={activeLine?.forks ?? []}
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

type SlickMenuItem =
  | { kind: 'item'; key: string; label: string; isCurrent: boolean; onPick: () => void }
  | { kind: 'header'; key: string; label: string };

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
  items: ReadonlyArray<SlickMenuItem>;
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
        items.map((it) =>
          it.kind === 'header' ? (
            <div
              key={it.key}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: t.inkSoft,
                textTransform: 'uppercase',
                letterSpacing: 0.7,
                padding: '10px 12px 4px',
                fontFamily: fonts.sans,
              }}
            >
              {it.label}
            </div>
          ) : (
            <button
              key={it.key}
              onClick={it.onPick}
              className="tabiya-popover-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px 10px 18px',
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
          )
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filterFamilies(families: readonly Family[], q: string): Family[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [...families];
  return families.filter((f) =>
    f.name.toLowerCase().includes(needle) ||
    f.eco_range.toLowerCase().includes(needle) ||
    f.category.toLowerCase().includes(needle)
  );
}

function filterLines(lines: readonly Line[], q: string): Line[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [...lines];
  return lines.filter((l) => l.name.toLowerCase().includes(needle));
}

/**
 * Group line picker items by parent Opening (= Variation), with section
 * headers between groups. Opening order follows the openings array order.
 */
function buildGroupedLineItems({
  lines,
  openings,
  selectedLineId,
  onPick,
}: {
  lines: readonly Line[];
  openings: readonly Opening[];
  selectedLineId: string;
  onPick: (id: string) => void;
}): SlickMenuItem[] {
  const openingOrder = new Map<string, number>();
  openings.forEach((o, idx) => openingOrder.set(o.id, idx));
  const openingName = new Map<string, string>();
  openings.forEach((o) => openingName.set(o.id, o.name));

  const byOpening = new Map<string, Line[]>();
  for (const line of lines) {
    const list = byOpening.get(line.opening_id) ?? [];
    list.push(line);
    byOpening.set(line.opening_id, list);
  }

  const sortedKeys = Array.from(byOpening.keys()).sort(
    (a, b) => (openingOrder.get(a) ?? 0) - (openingOrder.get(b) ?? 0)
  );

  const out: SlickMenuItem[] = [];
  for (const openingId of sortedKeys) {
    const groupLines = byOpening.get(openingId) ?? [];
    if (groupLines.length === 0) continue;
    if (groupLines.length === 1) {
      // Single line under this Variation — header would just duplicate the
      // line name. Show the variation name as the (only) item label.
      const line = groupLines[0]!;
      out.push({
        kind: 'item',
        key: line.id,
        label: openingName.get(openingId) ?? line.name,
        isCurrent: line.id === selectedLineId,
        onPick: () => onPick(line.id),
      });
    } else {
      // Multiple lines — emit Variation header + each line.
      out.push({
        kind: 'header',
        key: `h-${openingId}`,
        label: openingName.get(openingId) ?? openingId,
      });
      for (const line of groupLines) {
        out.push({
          kind: 'item',
          key: line.id,
          label: line.name,
          isCurrent: line.id === selectedLineId,
          onPick: () => onPick(line.id),
        });
      }
    }
  }
  return out;
}

function MoveHistoryGrid({
  moves,
  playedCount,
  nextIdx,
  forks,
}: {
  moves: readonly string[];
  playedCount: number;
  nextIdx?: number | undefined;
  forks?: readonly ForkAnnotation[];
}) {
  const t = useTokens();
  const [openForkPly, setOpenForkPly] = useState<number | null>(null);
  const forksByPly = new Map<number, ForkAnnotation>();
  if (forks) for (const f of forks) forksByPly.set(f.ply_index, f);

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
      position: 'relative',
    };
  };

  const renderCell = (idx: number) => {
    const fork = forksByPly.get(idx);
    return (
      <div data-testid={`move-cell-${idx}`} style={cellStyle(idx)}>
        <span>{moves[idx]}</span>
        {fork && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenForkPly((cur) => (cur === idx ? null : idx));
            }}
            aria-label={`Fork at ply ${idx}`}
            data-testid={`fork-badge-${idx}`}
            style={{
              marginLeft: 4,
              padding: 0,
              width: 14,
              height: 14,
              borderRadius: 999,
              background: t.amber ?? '#E0B423',
              color: '#fff',
              border: 'none',
              fontSize: 9,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              verticalAlign: 'middle',
            }}
            title={fork.label}
          >
            ⋔
          </button>
        )}
        {fork && openForkPly === idx && (
          <ForkPopover fork={fork} onClose={() => setOpenForkPly(null)} />
        )}
      </div>
    );
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
          {renderCell(r.wIdx)}
          {r.bIdx !== null ? renderCell(r.bIdx) : <div />}
        </div>
      ))}
    </div>
  );
}

function ForkPopover({ fork, onClose }: { fork: ForkAnnotation; onClose: () => void }) {
  const t = useTokens();
  const ref = useClickOutside<HTMLDivElement>(true, onClose);
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 4,
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        boxShadow: t.shadowMd,
        padding: 12,
        width: 280,
        zIndex: 50,
        fontFamily: fonts.sans,
        fontSize: 12.5,
        color: t.ink,
        textAlign: 'left',
        whiteSpace: 'normal',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, color: t.brand, marginBottom: 6 }}>
        {fork.label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {fork.alternatives.map((alt) => (
          <span
            key={alt}
            style={{
              padding: '2px 8px',
              background: t.surfaceAlt,
              borderRadius: 999,
              fontSize: 12,
              fontFamily: fonts.mono,
              color: t.ink,
            }}
          >
            {alt}
          </span>
        ))}
      </div>
      {fork.rationale && (
        <div style={{ fontSize: 12, color: t.inkDim, lineHeight: 1.45 }}>{fork.rationale}</div>
      )}
    </div>
  );
}
