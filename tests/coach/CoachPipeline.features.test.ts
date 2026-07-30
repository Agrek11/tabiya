/**
 * CoachPipeline v1↔v2 switch — Phase 4b. With features present the pipeline
 * uses prompt v2 (system prompt mentions VERIFIED FACTS, the rendered facts
 * reach the LLM) and reports promptVersion 'v2'; with no/empty features it
 * falls back to v1.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { analyzeMock, clientMock, completeMock } = vi.hoisted(() => ({
  analyzeMock: vi.fn(),
  completeMock: vi.fn(),
  clientMock: vi.fn(),
}));

vi.mock('../../src/engine/engineLoader', () => ({
  loadStockfishEngine: async () => ({ analyze: analyzeMock }),
}));
vi.mock('../../src/coach/container', () => ({ getLLMClient: clientMock }));

import { CoachPipeline, _setFeatureExtractorForTesting } from '../../src/coach/CoachPipeline';
import type { FeatureExtractor } from '../../src/coach/features/FeatureExtractor';
import type { PositionFeatures } from '../../src/coach/features/PositionFeatures';
import type { EngineAnalysis } from '../../src/engine/ChessEngine';

const ENGINE: EngineAnalysis = {
  fen: 'x',
  bestmove: 'd3',
  pvs: [{ moves: ['d3', 'Nf6'], scoreCp: 32, depth: 20 }],
  engineName: 'Stockfish 16',
  engineDepth: 20,
};

function featuresWith(pin: boolean): PositionFeatures {
  const f = {
    version: 2,
    material: { balance_cp: 0, imbalance: 'none', bishop_pair: { white: false, black: false } },
    pawns: {
      doubled: { white: [], black: [] }, isolated: { white: [], black: [] },
      backward: { white: [], black: [] }, passed: { white: [], black: [] },
      candidate_passers: { white: [], black: [] }, islands: { white: 1, black: 1 },
      chains: { white: [], black: [] },
      majorities: { queenside: null, kingside: null, center: null }, iqp: null, hanging_duo: null,
    },
    king_safety: {
      white: { castled: 'none', shield: 'n/a', adjacent_open_files: [], adjacent_half_open_files: [], king_zone_attackers: 0 },
      black: { castled: 'none', shield: 'n/a', adjacent_open_files: [], adjacent_half_open_files: [], king_zone_attackers: 0 },
    },
    center_space: { center_occupancy: {}, center_attacks: { white: 0, black: 0 }, space: { white: 0, black: 0 }, locked_center: false },
    files_diagonals: {
      open_files: [], half_open: { white: [], black: [] }, rooks_on_open: { white: [], black: [] },
      rooks_on_half_open: { white: [], black: [] }, rook_on_seventh: { white: [], black: [] }, long_diagonals: {},
    },
    activity: {
      mobility: { white: {}, black: {} },
      outposts: { white: { occupied: [], available: [] }, black: { occupied: [], available: [] } },
      bad_bishop: { white: null, black: null }, fianchetto: { white: null, black: null },
      trapped: { white: [], black: [] }, undeveloped_minors: { white: 0, black: 0 },
      tempo: { side_to_move: 'white', development_lead: 'even' },
    },
    tactics_geometry: { pins: [], xrays: [], overloaded: [], discovered_candidates: [], en_prise: [] },
  } as PositionFeatures;
  if (pin) f.tactics_geometry.pins = [{ pinned: 'Nf6', to: 'Qd8', by: 'Bg5', absolute: false }];
  return f;
}

const fx = (features: PositionFeatures | null): FeatureExtractor => ({
  extract: async () => features,
});

beforeEach(() => {
  analyzeMock.mockResolvedValue(ENGINE);
  completeMock.mockResolvedValue({ text: 'ok', modelName: 'm' });
  clientMock.mockReturnValue({ available: async () => true, complete: completeMock, providerName: 'cloud-anthropic', modelName: 'm' });
});
afterEach(() => vi.clearAllMocks());

describe('CoachPipeline prompt selection', () => {
  it('uses v2 with VERIFIED FACTS when features are notable', async () => {
    _setFeatureExtractorForTesting(fx(featuresWith(true)));
    const result = await CoachPipeline.run({ fen: 'x', history: [] });
    expect(result.promptVersion).toBe('v2');
    const { systemPrompt, userPrompt } = completeMock.mock.calls[0][0];
    expect(systemPrompt).toContain('VERIFIED FACTS');
    expect(userPrompt).toContain('relative pin: Bg5 pins Nf6 to Qd8');
  });

  it('falls back to v1 when the position is off-book (no features)', async () => {
    _setFeatureExtractorForTesting(fx(null));
    const result = await CoachPipeline.run({ fen: 'x', history: [] });
    expect(result.promptVersion).toBe('v1');
    const { userPrompt } = completeMock.mock.calls[0][0];
    expect(userPrompt).not.toContain('VERIFIED FACTS');
  });

  it('falls back to v1 when features are present but nothing is notable', async () => {
    _setFeatureExtractorForTesting(fx(featuresWith(false)));
    const result = await CoachPipeline.run({ fen: 'x', history: [] });
    expect(result.promptVersion).toBe('v1');
  });

  it('never throws if the extractor fails — degrades to v1', async () => {
    _setFeatureExtractorForTesting({ extract: async () => { throw new Error('boom'); } });
    const result = await CoachPipeline.run({ fen: 'x', history: [] });
    expect(result.promptVersion).toBe('v1');
    expect(result.engine).toEqual(ENGINE);
  });

  it('retries once when structured citations fail validation', async () => {
    _setFeatureExtractorForTesting(fx(featuresWith(true)));
    completeMock
      .mockResolvedValueOnce({
        text: 'bad',
        modelName: 'm',
        parsed: { tags_cited: ['not-in-context'] },
      })
      .mockResolvedValueOnce({
        text: 'good',
        modelName: 'm',
        parsed: { tags_cited: ['relative pin'] },
      });
    const result = await CoachPipeline.run({ fen: 'x', history: [] });
    expect(completeMock).toHaveBeenCalledTimes(2);
    expect(result.llm?.text).toBe('good');
  });

  it('drops llm narration when retry still fails citations', async () => {
    _setFeatureExtractorForTesting(fx(featuresWith(true)));
    completeMock
      .mockResolvedValueOnce({
        text: 'bad1',
        modelName: 'm',
        parsed: { tags_cited: ['not-in-context'] },
      })
      .mockResolvedValueOnce({
        text: 'bad2',
        modelName: 'm',
        parsed: { tags_cited: ['still-missing'] },
      });
    const result = await CoachPipeline.run({ fen: 'x', history: [] });
    expect(completeMock).toHaveBeenCalledTimes(2);
    expect(result.llm).toBeUndefined();
  });

  it('uses structured prose text when provider returns it', async () => {
    _setFeatureExtractorForTesting(fx(featuresWith(true)));
    completeMock.mockResolvedValueOnce({
      text: '{"prose":"raw"}',
      modelName: 'm',
      parsed: {
        prose: 'Structured explanation',
        tags_cited: ['relative pin'],
      },
    });
    const result = await CoachPipeline.run({ fen: 'x', history: [] });
    expect(result.llm?.text).toBe('Structured explanation');
  });
});
