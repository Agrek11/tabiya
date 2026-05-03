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
 * Functional behavior identical to old DrillView: catalog-driven, wrong
 * moves persistent, hint one-shot, last-move highlights, confetti on
 * complete, auto-restart.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { ChevronDown, Lightbulb, RotateCcw } from 'lucide-react';
import { useDrill } from '../drill/useDrill';
import { ChessBoardPanel } from '../ui/ChessBoardPanel';
import { useTokens } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { Card } from '../ui/primitives/Card';
import { Button } from '../ui/primitives/Button';
import { StateMessage } from '../ui/primitives/StateMessage';
import { getRepository } from '../storage';
import type { Line, Opening } from '../storage/types';
import { Inbox, AlertTriangle } from 'lucide-react';

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'ready'; openings: Opening[]; lines: Line[] }
  | { kind: 'error'; message: string };

function fireConfetti(): void {
  const common = { startVelocity: 45, spread: 70, ticks: 200, gravity: 0.9, scalar: 1 };
  void confetti({ ...common, particleCount: 60, origin: { x: 0.15, y: 0.9 }, angle: 60 });
  void confetti({ ...common, particleCount: 60, origin: { x: 0.85, y: 0.9 }, angle: 120 });
}

export function DrillPage() {
  const t = useTokens();
  const [searchParams] = useSearchParams();
  const requestedOpening = searchParams.get('opening');

  const [catalog, setCatalog] = useState<CatalogState>({ kind: 'loading' });
  const [selectedOpeningId, setSelectedOpeningId] = useState<string>('');
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [lineMenuOpen, setLineMenuOpen] = useState(false);

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
    showHint,
    stepBack,
    stepForward,
    restart,
  } = drill;

  // Square highlights.
  const squareStyles = useMemo<Record<string, CSSProperties>>(() => {
    const styles: Record<string, CSSProperties> = {};
    if (lastMove) {
      const lastStyle: CSSProperties = {
        backgroundColor: 'rgba(255, 200, 0, 0.55)',
        boxShadow: 'inset 0 0 0 3px rgba(230, 170, 0, 0.85)',
      };
      styles[lastMove.from] = { ...lastStyle };
      styles[lastMove.to] = { ...lastStyle };
    }
    if (hintSquare) {
      styles[hintSquare] = {
        ...(styles[hintSquare] ?? {}),
        backgroundColor: 'rgba(255, 90, 0, 0.65)',
        boxShadow: 'inset 0 0 0 4px rgba(255, 90, 0, 1)',
      };
    }
    return styles;
  }, [lastMove, hintSquare]);

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

  // Confetti.
  useEffect(() => {
    if (state.kind === 'complete') fireConfetti();
  }, [state.kind]);

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

  const wrongPending = state.kind === 'wrong_pending';
  const isComplete = state.kind === 'complete';

  return (
    <div className="tabiya-drill-layout" style={layoutStyle}>
      {/* Main column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {/* Title row + line switcher */}
        <div>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              onClick={() => setLineMenuOpen((v) => !v)}
              style={{
                background: lineMenuOpen ? t.surfaceAlt : 'transparent',
                border: `1px solid ${lineMenuOpen ? t.border : 'transparent'}`,
                padding: '4px 10px 4px 4px',
                marginLeft: -4,
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
                }}
              >
                {activeLine?.name ?? '—'}
              </h1>
              <ChevronDown
                size={18}
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
                openings={catalog.openings}
                lines={catalog.lines}
                selectedOpeningId={selectedOpeningId}
                selectedLineId={selectedLineId}
                onPick={(openingId, lineId) => {
                  setSelectedOpeningId(openingId);
                  setSelectedLineId(lineId);
                  setLineMenuOpen(false);
                }}
                onClose={() => setLineMenuOpen(false)}
              />
            )}
          </div>

          <div style={{ fontSize: 13, color: t.inkDim, marginTop: 4, fontFamily: fonts.mono }}>
            {activeOpening?.eco} · As {drillColor === 'white' ? 'White' : 'Black'} · {activeLine?.depth ?? 0} ply
          </div>
        </div>

        {/* Hero board */}
        <Card padding={12} style={{ width: '100%' }}>
          <div style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}>
            <ChessBoardPanel
              fen={fen}
              flashOverlay={flashOverlay}
              boardOrientation={playerColor}
              squareStyles={squareStyles}
              onPieceDrop={onPieceDrop}
            />
          </div>
        </Card>

        {/* Status strip */}
        <Card padding={14}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: wrongPending ? t.red : isComplete ? t.brand : t.ink,
                fontFamily: fonts.sans,
                flex: 1,
                minWidth: 200,
              }}
            >
              {statusText}
            </div>
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
      <div className="tabiya-drill-rail" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card padding={0}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}` }}>
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
          </div>
          <div style={{ padding: '10px 16px', maxHeight: 360, overflowY: 'auto' }}>
            <MoveHistory moves={drillMoves} state={state} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function MoveHistory({
  moves,
  state,
}: {
  moves: readonly string[];
  state: { kind: string; lineIndex?: number };
}) {
  const t = useTokens();
  const currentIdx = 'lineIndex' in state ? (state.lineIndex as number) : -1;

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
              <td
                style={{
                  fontWeight: 600,
                  padding: '5px 8px',
                  color: t.ink,
                  background: wIdx === currentIdx ? t.brandSoft : 'transparent',
                  borderRadius: 4,
                }}
              >
                {r.w}
              </td>
              <td
                style={{
                  fontWeight: 600,
                  padding: '5px 8px',
                  color: t.ink,
                  background: bIdx === currentIdx ? t.brandSoft : 'transparent',
                  borderRadius: 4,
                }}
              >
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
  openings,
  lines,
  selectedOpeningId,
  selectedLineId,
  onPick,
}: {
  openings: Opening[];
  lines: Line[];
  selectedOpeningId: string;
  selectedLineId: string;
  onPick: (openingId: string, lineId: string) => void;
  onClose: () => void;
}) {
  const t = useTokens();

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        width: 380,
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
      {openings.map((o) => {
        const oLines = lines.filter((l) => l.opening_id === o.id);
        return (
          <div key={o.id} style={{ marginBottom: 4 }}>
            <div
              style={{
                padding: '8px 10px 4px',
                fontSize: 11,
                fontWeight: 600,
                color: t.inkSoft,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                fontFamily: fonts.sans,
              }}
            >
              {o.name}
            </div>
            {oLines.length === 0 && (
              <div style={{ padding: '6px 10px', fontSize: 12, color: t.inkSoft, fontFamily: fonts.sans }}>
                No lines yet.
              </div>
            )}
            {oLines.map((line) => {
              const isCurrent = o.id === selectedOpeningId && line.id === selectedLineId;
              return (
                <button
                  key={line.id}
                  onClick={() => onPick(o.id, line.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 10px',
                    width: '100%',
                    background: isCurrent ? t.surfaceAlt : 'transparent',
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
                      {o.eco} · {line.depth} ply
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: t.inkSoft,
                      fontFamily: fonts.sans,
                    }}
                  >
                    Drill to track
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const layoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 280px',
  gap: 24,
  alignItems: 'flex-start',
};
