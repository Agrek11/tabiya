/**
 * CoachModal — Task 11.4. Engine-only degraded mode is a first-class render:
 * engine card present, degraded footer present, NO narration, NO console errors
 * (Article 11).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import type { EngineAnalysis } from '../../src/engine/ChessEngine';

const { runMock } = vi.hoisted(() => ({ runMock: vi.fn() }));
vi.mock('../../src/coach/CoachPipeline', async (orig) => {
  const actual = await orig<typeof import('../../src/coach/CoachPipeline')>();
  return { ...actual, CoachPipeline: { run: runMock } };
});

import { CoachModal } from '../../src/components/coach/CoachModal';
import { _clearCoachCache } from '../../src/hooks/useCoach';

const ENGINE: EngineAnalysis = {
  fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  bestmove: 'd3',
  pvs: [
    { moves: ['d3', 'd6', 'c3'], scoreCp: 32, depth: 20 },
    { moves: ['O-O', 'd6'], scoreCp: 28, depth: 20 },
  ],
  engineName: 'Stockfish 16',
  engineDepth: 20,
};

beforeEach(() => {
  localStorage.clear();
  _clearCoachCache();
  runMock.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CoachModal — engine-only degraded mode', () => {
  it('renders engine card + degraded footer, no narration, no console errors', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    runMock.mockResolvedValue({ engine: ENGINE, llm: undefined, promptVersion: 'v1' });

    renderWithProviders(
      <CoachModal lineName="Italian Game" lineId="L1" plyIndex={4} fen={ENGINE.fen} history={[]} onClose={() => {}} />,
    );

    // Engine card present (best move + a PV).
    await waitFor(() => expect(screen.getByText(/Best:/)).toBeTruthy());
    expect(screen.getByText(/PV 1:/)).toBeTruthy();

    // Degraded footer present; no narration card.
    expect(screen.getByTestId('coach-modal-degraded')).toBeTruthy();
    expect(screen.queryByTestId('coach-modal-narration')).toBeNull();

    expect(errSpy).not.toHaveBeenCalled();
  });

  it('renders narration card when the LLM result is present', async () => {
    runMock.mockResolvedValue({
      engine: ENGINE,
      llm: { text: 'd3 keeps the bishop retreat open.', modelName: 'claude-haiku-4-5-20251001' },
      promptVersion: 'v1',
    });

    renderWithProviders(
      <CoachModal lineName="Italian Game" plyIndex={4} fen={ENGINE.fen} history={[]} onClose={() => {}} />,
    );

    await waitFor(() => expect(screen.getByText(/keeps the bishop retreat open/)).toBeTruthy());
    expect(screen.queryByTestId('coach-modal-degraded')).toBeNull();
  });
});
