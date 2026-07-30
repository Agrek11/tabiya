import { describe, expect, it, vi } from 'vitest';
import type { FeatureExtractor } from '../../src/coach/features/FeatureExtractor';
import { generateExplainBlocks } from '../../src/coach/explain/generateExplainBlocks';

describe('generateExplainBlocks', () => {
  it('replays a line and enriches every resulting position through the feature seam', async () => {
    const extract = vi.fn().mockResolvedValue(null);
    const extractor: FeatureExtractor = { extract };

    const blocks = await generateExplainBlocks(['e4', 'e5', 'Nf3'], extractor);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({
      rationale: expect.stringContaining('1. e4'),
      arrows: [{ from: 'e2', to: 'e4', color: 'green' }],
      highlights: [{ square: 'e4', intent: 'focus' }],
    });
    expect(extract).toHaveBeenCalledTimes(3);
    expect(extract.mock.calls[0]?.[0]).toContain('4P3');
  });

  it('degrades to move-only blocks when feature extraction rejects', async () => {
    const extractor: FeatureExtractor = { extract: vi.fn().mockRejectedValue(new Error('sidecar unavailable')) };

    const blocks = await generateExplainBlocks(['e4'], extractor);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.rationale).toContain('1. e4');
  });

  it('keeps a minimal block for malformed catalog moves', async () => {
    const blocks = await generateExplainBlocks(['Qz9'], { extract: vi.fn().mockResolvedValue(null) });

    expect(blocks).toEqual([{ rationale: '1. Qz9 — book move.' }]);
  });
});
