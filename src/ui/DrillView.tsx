/**
 * DrillView — composes the chess board, status bar, and theme picker.
 *
 * Owns:
 *   - active board theme (persisted via localStorage)
 *   - confetti trigger on line completion
 * Calls useDrill() and pipes the values into presentational children.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import confetti from 'canvas-confetti';
import { useDrill } from '../drill/useDrill';
import { SAMPLE_LINE_NAME } from '../drill/sample-line';
import { ChessBoardPanel } from './ChessBoardPanel';
import { StatusBar } from './StatusBar';
import { ThemePicker } from './ThemePicker';
import { loadStoredTheme, saveTheme, type BoardTheme } from '../theme/themes';

const layoutStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  padding: '24px 16px',
};

const titleStyle: CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '18px',
  fontWeight: 600,
  color: '#222',
  margin: 0,
};

const subtitleStyle: CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '12px',
  color: '#666',
  margin: 0,
};

function fireConfetti(): void {
  // Two bursts from bottom corners, classic celebration shape.
  const common = { startVelocity: 45, spread: 70, ticks: 200, gravity: 0.9, scalar: 1 };
  void confetti({
    ...common,
    particleCount: 60,
    origin: { x: 0.15, y: 0.9 },
    angle: 60,
  });
  void confetti({
    ...common,
    particleCount: 60,
    origin: { x: 0.85, y: 0.9 },
    angle: 120,
  });
}

export function DrillView() {
  const [theme, setTheme] = useState<BoardTheme>(() => loadStoredTheme());
  const { state, fen, flashOverlay, statusText, playerColor, onPieceDrop } = useDrill();

  const onThemeChange = (t: BoardTheme) => {
    setTheme(t);
    saveTheme(t);
  };

  useEffect(() => {
    if (state.kind === 'complete') {
      fireConfetti();
    }
  }, [state.kind]);

  return (
    <main style={layoutStyle}>
      <h1 style={titleStyle}>tabiya</h1>
      <p style={subtitleStyle}>{SAMPLE_LINE_NAME}</p>
      <ThemePicker current={theme} onChange={onThemeChange} />
      <ChessBoardPanel
        fen={fen}
        flashOverlay={flashOverlay}
        boardOrientation={playerColor}
        theme={theme}
        onPieceDrop={onPieceDrop}
      />
      <StatusBar text={statusText} />
    </main>
  );
}
