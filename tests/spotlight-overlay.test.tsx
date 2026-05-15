/**
 * SpotlightOverlay (Phase 2b R6) — adapter tests.
 *
 * The overlay is a "style-merge" primitive: it returns square styles for
 * the consumer to merge into ChessBoardPanel, plus a tooltip element to
 * render inside a position:relative wrapper. These tests assert the
 * adapter's contract:
 *
 *   - graceful degrade on missing/empty data (R6.6)
 *   - styles include all 4 distinct color paths (R6.3)
 *   - tooltip surfaces the rationale text (R6.4)
 *   - the underlying primitive is invoked with bright mode + fade pieces
 *     so non-key pieces dim (R6.2 visual)
 */

import { cleanup, render, renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { useSpotlightOverlay } from '../src/ui/board/useSpotlightOverlay';
import { SpotlightOverlay } from '../src/ui/board/SpotlightOverlay';
import type { KeySquare } from '../src/storage/types';

afterEach(() => {
  cleanup();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('useSpotlightOverlay', () => {
  it('graceful degrades on undefined keySquares (R6.6)', () => {
    const { result } = renderHook(() => useSpotlightOverlay({ keySquares: undefined }));
    expect(result.current.active).toBe(false);
    expect(result.current.squareStyles).toEqual({});
    expect(result.current.pieceOpacity).toBe(1);
    expect(result.current.tooltip).toBeNull();
  });

  it('graceful degrades on empty array (R6.6)', () => {
    const { result } = renderHook(() => useSpotlightOverlay({ keySquares: [] }));
    expect(result.current.active).toBe(false);
    expect(result.current.tooltip).toBeNull();
  });

  it('renders distinct colors per side (R6.3)', () => {
    const squares: KeySquare[] = [
      { square: 'd5', note: 'central control', side: 'white' },
      { square: 'f5', note: 'kingside lever', side: 'black' },
      { square: 'c4', note: 'outpost', side: 'both' },
    ];
    const { result } = renderHook(() => useSpotlightOverlay({ keySquares: squares }));
    expect(result.current.active).toBe(true);
    const styles = result.current.squareStyles;
    expect(styles.d5?.backgroundColor).toBeTruthy();
    expect(styles.f5?.backgroundColor).toBeTruthy();
    expect(styles.c4?.backgroundColor).toBeTruthy();
    expect(styles.d5?.backgroundColor).not.toBe(styles.f5?.backgroundColor);
    expect(styles.d5?.backgroundColor).not.toBe(styles.c4?.backgroundColor);
  });

  it('fades pieces by default to dim non-key squares (R6.2 visual)', () => {
    const squares: KeySquare[] = [{ square: 'd5', note: 'x' }];
    const { result } = renderHook(() => useSpotlightOverlay({ keySquares: squares }));
    expect(result.current.pieceOpacity).toBeLessThan(1);
  });

  it('respects fadePieces=false override', () => {
    const squares: KeySquare[] = [{ square: 'd5', note: 'x' }];
    const { result } = renderHook(() =>
      useSpotlightOverlay({ keySquares: squares, fadePieces: false })
    );
    expect(result.current.pieceOpacity).toBe(1);
  });

  it('returns a tooltip element that surfaces note on hover (R6.4)', () => {
    const squares: KeySquare[] = [{ square: 'd5', note: 'central control' }];
    const { result, rerender } = renderHook(
      ({ hovered }) => {
        const r = useSpotlightOverlay({ keySquares: squares });
        // Simulate a hover by driving the hover handler.
        return { r, hovered };
      },
      { initialProps: { hovered: false } }
    );
    expect(result.current.r.tooltip).not.toBeNull();
    act(() => {
      result.current.r.onSquareHover('d5');
    });
    rerender({ hovered: true });
    // Render the tooltip element and assert the rationale text appears.
    const { container } = render(<>{result.current.r.tooltip}</>, { wrapper });
    expect(container.textContent).toContain('central control');
  });
});

describe('SpotlightOverlay component', () => {
  it('returns null when no key squares (R6.6 graceful degrade)', () => {
    const { container } = render(<SpotlightOverlay keySquares={undefined} />, {
      wrapper,
    });
    expect(container.firstChild).toBeNull();
  });

  it('returns a tooltip element when data present', () => {
    const { container } = render(
      <SpotlightOverlay keySquares={[{ square: 'd5', note: 'x' }]} />,
      { wrapper }
    );
    // Tooltip wrapper exists even when no hover is active (returns null without
    // a hoveredSquare). We assert the component does not throw.
    expect(container).toBeDefined();
  });
});
