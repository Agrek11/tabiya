/**
 * DrillView — composes the chess board, status bar, theme + opening + line pickers.
 *
 * Owns:
 *   - active board theme (persisted via localStorage)
 *   - active opening + line selection (component state, not persisted)
 *   - catalog load lifecycle (loading / ready / error)
 *   - confetti trigger on line completion
 * Calls useDrill() with the selected line's SAN moves.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import confetti from 'canvas-confetti';
import { useDrill } from '../drill/useDrill';
import { ChessBoardPanel } from './ChessBoardPanel';
import { StatusBar } from './StatusBar';
import { ThemePicker } from './ThemePicker';
import { OpeningPicker } from './OpeningPicker';
import { LinePicker } from './LinePicker';
import { loadStoredTheme, saveTheme, type BoardTheme } from '../theme/themes';
import { getRepository } from '../storage';
import type { Opening, Line } from '../storage/types';

const layoutStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  padding: '24px 16px',
};

const titleStyle: CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '20px',
  fontWeight: 700,
  color: '#222',
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '12px',
  color: '#666',
  margin: 0,
};

const pickerRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const stateMessageStyle: CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '14px',
  color: '#666',
  marginTop: '32px',
};

const hintRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const hintButton: CSSProperties = {
  padding: '6px 14px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  background: '#fff',
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  cursor: 'pointer',
  transition: 'background 120ms ease-out, transform 80ms ease-out',
};

const hintButtonShowing: CSSProperties = {
  ...hintButton,
  background: 'rgba(255, 165, 0, 0.85)',
  borderColor: 'rgba(255, 90, 0, 1)',
  color: '#fff',
  fontWeight: 600,
};

const shortcutHintStyle: CSSProperties = {
  fontSize: '11px',
  color: '#888',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const errorStyle: CSSProperties = {
  ...stateMessageStyle,
  color: '#c43',
};

function fireConfetti(): void {
  const common = { startVelocity: 45, spread: 70, ticks: 200, gravity: 0.9, scalar: 1 };
  void confetti({ ...common, particleCount: 60, origin: { x: 0.15, y: 0.9 }, angle: 60 });
  void confetti({ ...common, particleCount: 60, origin: { x: 0.85, y: 0.9 }, angle: 120 });
}

type CatalogState =
  | { kind: 'loading' }
  | { kind: 'ready'; openings: Opening[]; lines: Line[] }
  | { kind: 'error'; message: string };

export function DrillView() {
  const [theme, setTheme] = useState<BoardTheme>(() => loadStoredTheme());
  const [catalog, setCatalog] = useState<CatalogState>({ kind: 'loading' });
  const [selectedOpeningId, setSelectedOpeningId] = useState<string>('');
  const [selectedLineId, setSelectedLineId] = useState<string>('');

  // Load catalog once on mount.
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
        const firstOpening = openings[0]!;
        const lines = await repo.listLines(firstOpening.id);
        if (cancelled) return;
        if (lines.length === 0) {
          setCatalog({ kind: 'error', message: 'Selected opening has no lines.' });
          return;
        }
        setCatalog({ kind: 'ready', openings, lines });
        setSelectedOpeningId(firstOpening.id);
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
  }, []);

  // When opening selection changes (after initial load), refresh available
  // lines and pick the first line of the new opening.
  useEffect(() => {
    if (catalog.kind !== 'ready' || selectedOpeningId === '') return;
    // Skip if the lines for this opening are already in state.
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

  const onThemeChange = (t: BoardTheme) => {
    setTheme(t);
    saveTheme(t);
  };

  // Compute the active opening + line (or null if none).
  const activeOpening: Opening | null = useMemo(() => {
    if (catalog.kind !== 'ready') return null;
    return catalog.openings.find((o) => o.id === selectedOpeningId) ?? null;
  }, [catalog, selectedOpeningId]);

  const activeLine: Line | null = useMemo(() => {
    if (catalog.kind !== 'ready') return null;
    return catalog.lines.find((l) => l.id === selectedLineId) ?? null;
  }, [catalog, selectedLineId]);

  // Drive the drill with the active line's moves and the opening's color
  // (which side the user is drilling). Fall back to 'black' for the
  // pre-load / empty case.
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

  // Per-square highlights. Using high-contrast colors for the moment so they
  // are unmistakable on any board theme.
  //   - Last move (from + to): translucent gold filling the whole square
  //   - Hint square: bright orange with a thick ring
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

  // Keyboard shortcuts: ← back, → forward, R / Home restart, H toggle hint.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      // Don't intercept while user is typing in inputs/selects.
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

  useEffect(() => {
    if (state.kind === 'complete') {
      fireConfetti();
    }
  }, [state.kind]);

  if (catalog.kind === 'loading') {
    return (
      <main style={layoutStyle}>
        <h1 style={titleStyle}>tabiya</h1>
        <p style={stateMessageStyle}>Loading catalog…</p>
      </main>
    );
  }

  if (catalog.kind === 'error') {
    return (
      <main style={layoutStyle}>
        <h1 style={titleStyle}>tabiya</h1>
        <p style={errorStyle}>{catalog.message}</p>
      </main>
    );
  }

  return (
    <main style={layoutStyle}>
      <h1 style={titleStyle}>tabiya</h1>
      <p style={subtitleStyle}>{activeLine ? activeLine.name : 'Select a line to drill'}</p>
      <div style={pickerRowStyle}>
        <OpeningPicker
          openings={catalog.openings}
          value={selectedOpeningId}
          onChange={setSelectedOpeningId}
        />
        <LinePicker lines={catalog.lines} value={selectedLineId} onChange={setSelectedLineId} />
      </div>
      <ThemePicker current={theme} onChange={onThemeChange} />
      <ChessBoardPanel
        fen={fen}
        flashOverlay={flashOverlay}
        boardOrientation={playerColor}
        theme={theme}
        squareStyles={squareStyles}
        onPieceDrop={onPieceDrop}
      />
      <div style={hintRowStyle}>
        <button
          style={hintSquare !== null ? hintButtonShowing : hintButton}
          onClick={showHint}
          disabled={state.kind !== 'awaiting_player'}
          title="Highlight the piece that should move next (key: H)"
        >
          {hintSquare !== null ? '💡 Showing…' : '💡 Hint'}
        </button>
        <span style={shortcutHintStyle}>
          ← back · → forward · R restart · H hint
        </span>
      </div>
      <StatusBar text={statusText} />
    </main>
  );
}
