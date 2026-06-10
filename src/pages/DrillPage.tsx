/**
 * DrillPage — drill workspace matched to v1 preview.
 *
 * Source: specs/wireframes/tabiya-v1-preview.html `data-page="drill"`.
 *
 * Stack top to bottom:
 *   Drill Toolbar (64px, surface): Opening pill | Variation pill | Mode pill | stats
 *   Pills row    (queue chip + box chip)
 *   Progress strip (eyebrow + counts + bar)
 *   Workspace grid 1fr / 280px:
 *     [Board shell + Moves row]  |  [Why This Move rail]
 *
 * Behavior preserved from the prior implementation:
 *   - useDrill + ChessBoardPanel (untouched)
 *   - useExplainContent + useLinePrefMode + ExplainView
 *   - SRS write on completion + fire-and-forget guard
 *   - Queue mode init from ?queue=due, advance on completion, exhausted state
 *   - useEventEmitter telemetry (Phase 1.5 R7.5)
 *   - Keyboard nav (← → R H Esc)
 *   - Click-to-move
 *   - Hint pulse tier 1 → tier 2 escalation
 *   - End-of-line summary in non-queue mode
 *   - Confetti on completion
 *   - Effective repertoire pick filter
 *
 * Visual deltas vs v1.3:
 *   - Strategic notes panel removed; rationale now lives in the Why This Move
 *     rail (key squares included).
 *   - Move history right rail dropped; the played-moves chip row sits inline
 *     under the board.
 *   - Restart / Skip / Hint moved into a (⋮) overflow dropdown on the moves row.
 *   - Mode pill replaces the prior ModeToggle row.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  Inbox,
  Target,
} from 'lucide-react';
import { useClickOutside } from '../ui/use-click-outside';
import { useDrill } from '../drill/useDrill';
import { WhyButton } from '../components/coach/WhyButton';
import { useSRS } from '../hooks/useSRS';
import { useEventEmitter } from '../hooks/useEventEmitter';
import { useEffectivePick } from '../hooks/useEffectivePick';
import { useExplainContent } from '../hooks/useExplainContent';
import { useLinePrefMode } from '../hooks/useLinePrefMode';
import { ExplainView } from '../ui/explain/ExplainView';
import { ChessBoardPanel } from '../ui/ChessBoardPanel';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { StateMessage } from '../ui/primitives/StateMessage';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { EndOfLineSummary } from '../ui/EndOfLineSummary';
import { PillTrigger } from '../components/drill/PillTrigger';
import { SlickMenu, type SlickMenuItem } from '../components/drill/SlickMenu';
import { MovesRow, type OverflowItem } from '../components/drill/MovesRow';
import { WhyThisMoveRail } from '../components/drill/WhyThisMoveRail';
import { DrillModeToggleHeader } from '../components/drill/DrillModeToggleHeader';
import { TranspositionBanner } from '../components/drill/TranspositionBanner';
import { useSpotlightOverlay } from '../ui/board/useSpotlightOverlay';
import { useKeySquareOverlay } from '../hooks/useKeySquareOverlay';
import { useTransposition } from '../hooks/useTransposition';
import { getRepository, getSrsRepository } from '../storage';
import type { Family, Line, Opening } from '../storage/types';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'ready'; openings: Opening[]; lines: Line[]; families: Family[] }
  | { kind: 'error'; message: string };

type QueueState =
  | { kind: 'off' }
  | { kind: 'active'; lineIds: string[]; index: number }
  | { kind: 'exhausted'; total: number };

type ModeId = 'drill' | 'explain' | 'pattern-viz';

const MODE_LABELS: Record<ModeId, string> = {
  drill: 'Drill mode',
  explain: 'Explain',
  'pattern-viz': 'Pattern Viz',
};

const MODE_PILL_TARGET_RADIUS = 12;

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedLine = searchParams.get('line');
  const requestedOpening = searchParams.get('opening');
  const requestedQueue = searchParams.get('queue');

  const [catalog, setCatalog] = useState<CatalogState>({ kind: 'loading' });
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [queueState, setQueueState] = useState<QueueState>({ kind: 'off' });
  const [queueToast, setQueueToast] = useState<string | null>(null);
  const [openingMenuOpen, setOpeningMenuOpen] = useState(false);
  const [openingSearch, setOpeningSearch] = useState('');
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [lineSearch, setLineSearch] = useState('');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<ModeId>('drill');
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

  // Catalog load.
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
        const allLineLists = await Promise.all(openings.map((o) => repo.listLines(o.id)));
        const lines = allLineLists.flat();
        if (cancelled) return;

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

  const { dueLineIds, loading: srsLoading } = useSRS();
  const { effective } = useEffectivePick();

  // Queue init.
  useEffect(() => {
    if (requestedQueue !== 'due') return;
    if (catalog.kind !== 'ready') return;
    if (srsLoading) return;
    if (queueState.kind !== 'off') return;
    if (dueLineIds.length === 0) {
      setQueueState({ kind: 'exhausted', total: 0 });
      return;
    }
    const valid = dueLineIds
      .filter((id) => catalog.lines.some((l) => l.id === id))
      .filter((id) => !effective.isFiltered || effective.lineIds.has(id));
    if (valid.length === 0) {
      setQueueState({ kind: 'exhausted', total: 0 });
      return;
    }
    setQueueState({ kind: 'active', lineIds: valid, index: 0 });
    setSelectedLineId(valid[0]!);
    const firstLine = catalog.lines.find((l) => l.id === valid[0]);
    const firstOpening = firstLine
      ? catalog.openings.find((o) => o.id === firstLine.opening_id)
      : undefined;
    if (firstOpening) setSelectedFamilyId(firstOpening.family_id);
  }, [requestedQueue, catalog, srsLoading, dueLineIds, queueState.kind, effective]);

  // Family change → reset line to first in family.
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
  const drillColor: 'white' | 'black' = activeOpening?.color ?? 'white';

  // Explain Mode sidecar.
  const activeLineId: string | null = activeLine?.id ?? null;
  const explainContent = useExplainContent({
    lineId: activeLineId,
    expectedLength: drillMoves.length,
  });
  const [explainMode, setExplainMode] = useLinePrefMode(activeLineId);

  // Drill engine.
  const drill = useDrill(drillMoves, drillColor);
  const {
    state,
    fen,
    flashOverlay,
    playerColor,
    onPieceDrop,
    lastMove,
    hintSquare,
    hintTier,
    showHint,
    stepForward,
    restart,
    jumpToPly,
    legalMovesFrom,
    drillResult,
  } = drill;

  // Phase 1.5 telemetry.
  const { emit: emitEvent } = useEventEmitter(activeLineId);
  const prevDrillStateKindRef = useRef<string | null>(null);
  const completeEmittedForRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevDrillStateKindRef.current;
    prevDrillStateKindRef.current = state.kind;
    if (activeLine === null) return;

    if (
      prev === 'awaiting_player' &&
      state.kind === 'flash_correct' &&
      'lineIndex' in state
    ) {
      emitEvent('move_correct', state.lineIndex - 1);
      return;
    }
    if (
      prev === 'awaiting_player' &&
      state.kind === 'wrong_pending' &&
      'lineIndex' in state
    ) {
      emitEvent('move_wrong', state.lineIndex);
      return;
    }
    if (state.kind === 'complete' && completeEmittedForRef.current !== activeLine.id) {
      completeEmittedForRef.current = activeLine.id;
      emitEvent('line_complete', Math.max(0, drillMoves.length - 1));
    }
  }, [state, activeLine, drillMoves.length, emitEvent]);

  useEffect(() => {
    completeEmittedForRef.current = null;
  }, [activeLineId]);

  const showHintWithEmit = useCallback((): void => {
    if (activeLine !== null && 'lineIndex' in state) {
      emitEvent('hint_used', (state as { lineIndex: number }).lineIndex);
    }
    showHint();
  }, [activeLine, state, showHint, emitEvent]);

  // SRS write on completion.
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

  // Queue auto-advance.
  useEffect(() => {
    if (state.kind !== 'complete') return;
    if (queueState.kind !== 'active') return;
    if (catalog.kind !== 'ready') return;
    if (activeLine === null) return;
    const currentLineId = queueState.lineIds[queueState.index];
    if (currentLineId !== activeLine.id) return;
    const nextIndex = queueState.index + 1;
    if (nextIndex >= queueState.lineIds.length) {
      setQueueState({ kind: 'exhausted', total: queueState.lineIds.length });
      return;
    }
    const id = window.setTimeout(() => {
      const nextLineId = queueState.lineIds[nextIndex]!;
      const nextLine = catalog.lines.find((l) => l.id === nextLineId);
      const nextOpening = nextLine
        ? catalog.openings.find((o) => o.id === nextLine.opening_id)
        : undefined;
      setQueueState({ ...queueState, index: nextIndex });
      setSelectedLineId(nextLineId);
      if (nextOpening) setSelectedFamilyId(nextOpening.family_id);
      if (nextLine) setQueueToast(`Next: ${nextLine.name}`);
    }, 800);
    return () => window.clearTimeout(id);
  }, [state, queueState, catalog, activeLine]);

  // Queue toast auto-dismiss.
  useEffect(() => {
    if (queueToast === null) return;
    const id = window.setTimeout(() => setQueueToast(null), 1800);
    return () => window.clearTimeout(id);
  }, [queueToast]);

  const exitQueue = useCallback(() => {
    if (queueState.kind !== 'off') setQueueState({ kind: 'off' });
  }, [queueState.kind]);

  // Click-to-move.
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

  // Phase 2b — Pattern Viz overlay (R6/R7).
  // The drill-mode toggle persists per-line; Explain Mode force-on is
  // handled inside the hook. ExplainView is rendered in a separate branch
  // below — `explainModeActive=true` here applies when the user picked
  // explain mode for this line but the explain content didn't load
  // (graceful degrade) OR before the explain branch renders.
  const explainModeActive = explainMode === 'explain';
  const keySquareToggle = useKeySquareOverlay({
    lineId: activeLineId,
    hasKeySquares: (activeLine?.key_squares?.length ?? 0) > 0,
    explainModeActive,
  });
  const spotlight = useSpotlightOverlay({
    keySquares: keySquareToggle.visible ? activeLine?.key_squares : undefined,
  });

  const squareStyles = useMemo<Record<string, CSSProperties>>(() => {
    const styles: Record<string, CSSProperties> = { ...spotlight.squareStyles };
    if (lastMove) {
      const lastStyle: CSSProperties = { backgroundColor: 'rgba(155, 199, 0, 0.42)' };
      styles[lastMove.from] = { ...(styles[lastMove.from] ?? {}), ...lastStyle };
      styles[lastMove.to] = { ...(styles[lastMove.to] ?? {}), ...lastStyle };
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
  }, [lastMove, hintSquare, hintTier, spotlight.squareStyles]);

  // Phase 2b — Transposition banner (R8). Picked repertoire comes from
  // useEffectivePick; lineNames map is derived from the catalog. Banner
  // is drill-only (suppressed in Explain Mode via the OQ3 resolution).
  const pickedLineIds = effective.lineIds;
  const lineNames = useMemo(() => {
    if (catalog.kind !== 'ready') return new Map<string, string>();
    const m = new Map<string, string>();
    for (const l of catalog.lines) m.set(l.id, l.name);
    return m;
  }, [catalog]);
  const currentPlyForTransposition = 'lineIndex' in state ? (state.lineIndex as number) : 0;
  const transposition = useTransposition({
    currentFen: fen,
    currentPly: currentPlyForTransposition,
    activeLineId,
    pickedLineIds,
    lineNames,
  });
  const onTranspositionJump = useCallback(
    (lineId: string): void => {
      navigate(`/drill?line=${lineId}`);
    },
    [navigate]
  );

  // Keyboard nav.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          drill.stepBack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          drill.stepForward();
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
          if (queueState.kind === 'active') {
            exitQueue();
          } else {
            setSelectedSquare(null);
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drill, restart, showHintWithEmit, queueState.kind, exitQueue]);

  // Confetti on completion.
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
                color: t.brandInk,
                border: 'none',
                padding: '10px 18px',
                borderRadius: 10,
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

  const currentPly = 'lineIndex' in state ? (state.lineIndex as number) : drillMoves.length;
  const totalPly = drillMoves.length;
  const progressPct = totalPly === 0 ? 0 : (currentPly / totalPly) * 100;
  const playedCount =
    state.kind === 'complete' ? drillMoves.length : ('lineIndex' in state ? (state.lineIndex as number) : 0);
  const nextIdx = state.kind === 'awaiting_player' ? state.lineIndex : undefined;

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

  // Drill stats — wired where available.
  const accuracySoFar = totalPly > 0 ? Math.round((currentPly / totalPly) * 100) : 0;

  const isExplainViewActive =
    explainMode === 'explain' &&
    explainContent.kind === 'loaded' &&
    activeLine !== null;

  const overflowItems: OverflowItem[] = [
    {
      label: 'Restart',
      onClick: restart,
      disabled: !drill.canRestart,
      testid: 'drill-restart',
    },
    {
      label: 'Skip line',
      onClick: stepForward,
      disabled: !drill.canStepForward,
      testid: 'drill-skip',
    },
    {
      label: 'Show hint',
      onClick: showHintWithEmit,
      disabled: state.kind !== 'awaiting_player',
      testid: 'drill-hint',
    },
  ];

  return (
    <div
      className="tabiya-drill-layout"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* TOOLBAR */}
      <div
        style={{
          height: 64,
          borderBottom: `0.5px solid ${t.border}`,
          background: t.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Opening pill */}
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
                items={filteredFamilies.map(
                  (f): SlickMenuItem => ({
                    kind: 'item',
                    key: f.id,
                    label: f.name,
                    isCurrent: f.id === selectedFamilyId,
                    onPick: () => {
                      setSelectedFamilyId(f.id);
                      closeOpeningMenu();
                      exitQueue();
                    },
                  })
                )}
                emptyHint={
                  openingSearch.trim()
                    ? `No openings match "${openingSearch}"`
                    : 'No openings yet.'
                }
              />
            )}
          </div>
          {/* Variation/Line pill */}
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
          {/* Mode pill */}
          <div ref={modeMenuRef} style={{ position: 'relative' }}>
            <PillTrigger
              label={MODE_LABELS[activeMode]}
              open={modeMenuOpen}
              onClick={() => setModeMenuOpen((v) => !v)}
              ariaLabel="Switch mode"
              accent={<TargetGlyph color={t.brand} />}
            />
            {modeMenuOpen && (
              <ModeMenu
                activeMode={activeMode}
                explainAvailable={explainContent.kind === 'loaded'}
                onPick={(id) => {
                  if (id === 'explain' && explainContent.kind === 'loaded') {
                    setExplainMode('explain');
                  } else if (id === 'drill') {
                    setExplainMode('drill');
                  }
                  setActiveMode(id);
                  setModeMenuOpen(false);
                }}
              />
            )}
          </div>
          {/* Phase 2b — Key squares overlay toggle (R7). Hidden when the
              active opening has no curated key_squares (graceful degrade). */}
          {!keySquareToggle.toggleDisabled && (
            <DrillModeToggleHeader
              active={keySquareToggle.drillPreference}
              forcedByExplain={explainModeActive && keySquareToggle.visible}
              onClick={keySquareToggle.toggle}
            />
          )}
        </div>

        {/* Stats strip */}
        <DrillStats
          dueCount={dueLineIds.length}
          retentionPct={accuracySoFar}
          hasAccuracy={totalPly > 0}
        />
      </div>

      {/* PILLS ROW (queue chip only — Box pill removed per UI fix 2026-05-15) */}
      {queueState.kind === 'active' && (
        <div
          style={{
            padding: '16px 28px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <Chip
            tone="brand"
            onClick={exitQueue}
            testid="queue-chip"
            title="Exit queue mode"
          >
            Queue {queueState.index + 1}/{queueState.lineIds.length} ✕
          </Chip>
        </div>
      )}

      {/* PROGRESS STRIP */}
      <div style={{ padding: '14px 28px 0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: t.inkSoft,
            fontWeight: 600,
            marginBottom: 7,
            fontFamily: fonts.sans,
          }}
        >
          <span>Training Progress</span>
          <span>
            {playedCount} / {totalPly} Completed
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Drill progress ${Math.round(progressPct)}%`}
          aria-valuenow={Math.round(progressPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            height: 8,
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
              transition: 'width 300ms ease',
            }}
          />
        </div>
      </div>

      {/* WORKSPACE.
         Layout:
           - Col 1 = Board (big, capped by viewport).
           - Col 2 = stack [Moves card top, WhyThisMove card bottom].
           - Col 3 = EndOfLine card (only when complete; column collapses otherwise). */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: isExplainViewActive
            ? '1fr'
            : state.kind === 'complete' && queueState.kind !== 'active'
              ? 'auto 320px 320px'
              : 'auto 320px',
          justifyContent: 'center',
          gap: 12,
          padding: '10px 20px 14px',
          alignItems: 'start',
          background: `radial-gradient(circle at center, ${t.bg} 0%, ${t.surfaceAlt} 100%)`,
        }}
      >
        {isExplainViewActive ? (
          <div>
            <ExplainView
              key={`explain-${activeLine.id}`}
              line={activeLine}
              blocks={
                explainContent.kind === 'loaded' ? explainContent.data : []
              }
              playerColor={drillColor}
              totalPlies={drillMoves.length}
              onSkipToDrill={() => {
                setExplainMode('drill');
                setActiveMode('drill');
              }}
              /* R7.3 — Pattern Viz key squares force on for the explain run. */
              patternKeySquares={activeLine.key_squares}
            />
          </div>
        ) : (
          <>
            {/* COL 1 — board + inline actions */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                width: '100%',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  borderRadius: MODE_PILL_TARGET_RADIUS * 2,
                  overflow: 'hidden',
                  border: `0.5px solid ${t.border}`,
                  background: t.surface,
                  boxShadow: t.shadowLg,
                  position: 'relative',
                  width: 'min(900px, calc(100vh - 230px))',
                  height: 'min(900px, calc(100vh - 230px))',
                }}
              >
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
                {/* Phase 2b — Pattern Viz tooltip surface (R6.4). The
                    spotlight square-styles flow through `squareStyles`
                    above; this overlay only carries the hover tooltip
                    element. The board wrapper is position:relative
                    (parent `<div>` above), so the tooltip absolute-
                    positions inside it. */}
                {spotlight.tooltip}
              </div>

              {/* Inline action buttons: Restart / Skip / Hint */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '2px 0',
                }}
              >
                {overflowItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    disabled={item.disabled}
                    data-testid={item.testid}
                    style={{
                      padding: '6px 13px',
                      borderRadius: 999,
                      background: t.surface,
                      border: `0.5px solid ${t.border}`,
                      color: item.disabled ? t.inkSoft : t.ink,
                      fontSize: 12.5,
                      fontFamily: fonts.sans,
                      fontWeight: 600,
                      cursor: item.disabled ? 'not-allowed' : 'pointer',
                      opacity: item.disabled ? 0.5 : 1,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
                {/* Phase 4a — Coach "Why?" (Surface A). Opens engine + LLM
                    narration for the current position; `?` shortcut too. */}
                {activeLine ? (
                  <WhyButton
                    lineName={activeLine.name}
                    lineId={activeLineId ?? undefined}
                    fen={fen}
                    plyIndex={playedCount}
                    lineSans={drillMoves}
                  />
                ) : null}
              </div>
            </div>

            {/* COL 2 — Moves card on top, WhyThisMove card on bottom */}
            <aside
              style={{
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Phase 2b — Transposition banner (R8). Drill-only per
                  OQ3 resolution; Explain Mode renders in its own branch
                  above and never reaches this aside. */}
              <TranspositionBanner
                matches={transposition.matches}
                truncatedCount={transposition.truncated}
                onJump={onTranspositionJump}
              />
              <Card>
                <CardTitle>Moves</CardTitle>
                <MovesRow
                  moves={drillMoves}
                  playedCount={playedCount}
                  nextIdx={nextIdx}
                  forks={activeLine?.forks ?? []}
                  onJumpToPly={(ply) => jumpToPly(ply + 1)}
                />
              </Card>
              <WhyThisMoveRail
                notes={activeLine?.strategic_notes ?? []}
                keySquares={(activeLine?.key_squares ?? []).map((k) => k.square)}
              />
            </aside>

            {/* COL 3 — End-of-line summary (only when complete + non-queue) */}
            {state.kind === 'complete' &&
              queueState.kind !== 'active' &&
              activeLine !== null &&
              drillResult !== null && (
                <aside style={{ minWidth: 0 }}>
                  <EndOfLineSummary
                    line={activeLine}
                    drillResult={drillResult}
                    dueCount={dueLineIds.length}
                    nextLineInFamily={(() => {
                      if (catalog.kind !== 'ready' || activeFamily === null) return null;
                      const famOpIds = new Set(
                        catalog.openings
                          .filter((o) => o.family_id === activeFamily.id)
                          .map((o) => o.id)
                      );
                      const famLines = catalog.lines.filter((l) => famOpIds.has(l.opening_id));
                      const idx = famLines.findIndex((l) => l.id === activeLine.id);
                      return idx >= 0 && idx + 1 < famLines.length ? famLines[idx + 1]! : null;
                    })()}
                    onRestart={restart}
                    onPickLine={(id) => setSelectedLineId(id)}
                  />
                </aside>
              )}
          </>
        )}
      </div>

      {/* Queue toast */}
      {queueToast !== null && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: t.ink,
            color: t.bg,
            padding: '10px 16px',
            borderRadius: 999,
            fontSize: 13,
            fontFamily: fonts.sans,
            boxShadow: t.shadowMd,
            zIndex: 100,
          }}
        >
          {queueToast}
        </div>
      )}
    </div>
  );
}

function DrillStats({
  dueCount,
  retentionPct,
  hasAccuracy,
}: {
  dueCount: number;
  retentionPct: number;
  hasAccuracy: boolean;
}) {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        fontSize: 12.5,
        color: t.inkDim,
        fontFamily: fonts.sans,
      }}
    >
      <span>
        <strong style={{ color: t.ink, fontWeight: 600 }}>{dueCount}</strong> due
      </span>
      <span>
        <span style={{ color: t.success, fontWeight: 600 }}>
          {hasAccuracy ? `${retentionPct}%` : '—'}
        </span>{' '}
        retention
      </span>
      <span>
        <span style={{ color: t.brand, fontWeight: 600 }}>—</span> streak
      </span>
    </div>
  );
}

function ModeMenu({
  activeMode,
  explainAvailable,
  onPick,
}: {
  activeMode: ModeId;
  explainAvailable: boolean;
  onPick: (id: ModeId) => void;
}) {
  const t = useTokens();
  const items: Array<{ id: ModeId; label: string; available: boolean }> = [
    { id: 'drill', label: 'Drill mode', available: true },
    { id: 'explain', label: 'Explain', available: explainAvailable },
    { id: 'pattern-viz', label: 'Pattern Viz', available: false },
  ];
  return (
    <div
      role="menu"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 220,
        background: t.surface,
        border: `0.5px solid ${t.border}`,
        borderRadius: 12,
        boxShadow: t.shadowMd,
        padding: 6,
        zIndex: 50,
      }}
    >
      {items.map((m) => {
        const isActive = m.id === activeMode;
        return (
          <button
            key={m.id}
            onClick={() => m.available && onPick(m.id)}
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
              borderRadius: 10,
              cursor: m.available ? 'pointer' : 'not-allowed',
              textAlign: 'left',
              fontFamily: fonts.sans,
              fontSize: 13.5,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? t.brand : m.available ? t.ink : t.inkSoft,
              opacity: m.available ? 1 : 0.65,
            }}
          >
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
                  letterSpacing: '0.04em',
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
  );
}

function Chip({
  children,
  tone = 'default',
  onClick,
  title,
  testid,
}: {
  children: React.ReactNode;
  tone?: 'default' | 'brand';
  onClick?: () => void;
  title?: string;
  testid?: string;
}) {
  const t = useTokens();
  const isBrand = tone === 'brand';
  return (
    <span
      onClick={onClick}
      title={title}
      data-testid={testid}
      role={onClick ? 'button' : undefined}
      style={{
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        border: `0.5px solid ${isBrand ? t.brandSoftBorder : t.border}`,
        background: isBrand ? t.brandSoft : t.surface,
        color: isBrand ? t.brand : t.inkDim,
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: fonts.sans,
      }}
    >
      {children}
    </span>
  );
}

function TargetGlyph({ color }: { color: string }) {
  return (
    <Target
      size={13}
      strokeWidth={2}
      color={color}
      aria-hidden
    />
  );
}

function filterFamilies(families: readonly Family[], q: string): Family[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [...families];
  return families.filter(
    (f) =>
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
      const line = groupLines[0]!;
      out.push({
        kind: 'item',
        key: line.id,
        label: openingName.get(openingId) ?? line.name,
        isCurrent: line.id === selectedLineId,
        onPick: () => onPick(line.id),
      });
    } else {
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
