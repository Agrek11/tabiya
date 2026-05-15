/**
 * <ArrowLayer> tests — SVG arrow rendering + flip geometry (R3, Article 15).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ArrowLayer } from '../../src/ui/board/ArrowLayer';
import { getSquarePixel } from '../../src/ui/board/squareGeometry';
import type { Arrow } from '../../src/storage/types';

afterEach(() => cleanup());

describe('<ArrowLayer>', () => {
  it('empty arrows renders an empty (no <line>) svg', () => {
    render(<ArrowLayer arrows={[]} boardSize={400} isFlipped={false} />);
    const svg = screen.getByTestId('arrow-layer');
    expect(svg.querySelectorAll('line').length).toBe(0);
  });

  it('single arrow renders one <line> with markerEnd', () => {
    const arrows: Arrow[] = [{ from: 'e2', to: 'e4' }];
    render(<ArrowLayer arrows={arrows} boardSize={400} isFlipped={false} />);
    const lines = screen.getByTestId('arrow-layer').querySelectorAll('line');
    expect(lines.length).toBe(1);
    const markerEnd = lines[0]?.getAttribute('marker-end');
    expect(markerEnd).toContain('tabiya-arrowhead-green');
  });

  it('respects arrow color (red)', () => {
    const arrows: Arrow[] = [{ from: 'e2', to: 'e4', color: 'red' }];
    render(<ArrowLayer arrows={arrows} boardSize={400} isFlipped={false} />);
    const line = screen.getByTestId('arrow-layer').querySelector('line');
    expect(line?.getAttribute('marker-end')).toContain('tabiya-arrowhead-red');
  });

  it('renders multiple arrows', () => {
    const arrows: Arrow[] = [
      { from: 'e2', to: 'e4' },
      { from: 'd7', to: 'd5', color: 'blue' },
    ];
    render(<ArrowLayer arrows={arrows} boardSize={400} isFlipped={false} />);
    expect(screen.getByTestId('arrow-layer').querySelectorAll('line').length).toBe(2);
  });
});

describe('getSquarePixel', () => {
  it('a1 not-flipped → bottom-left center', () => {
    const { x, y } = getSquarePixel('a1', false, 400);
    expect(x).toBe(25); // 50/2
    expect(y).toBe(375); // 350 + 25
  });

  it('h8 not-flipped → top-right center', () => {
    const { x, y } = getSquarePixel('h8', false, 400);
    expect(x).toBe(375);
    expect(y).toBe(25);
  });

  it('a1 flipped → top-right center (mirror)', () => {
    const { x, y } = getSquarePixel('a1', true, 400);
    expect(x).toBe(375);
    expect(y).toBe(25);
  });

  it('malformed square → NaN', () => {
    const { x, y } = getSquarePixel('z9', false, 400);
    expect(Number.isNaN(x)).toBe(true);
    expect(Number.isNaN(y)).toBe(true);
  });
});
