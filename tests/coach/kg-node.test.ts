import { describe, expect, it, vi } from 'vitest';
import { lookupKgNode, renderKgBlock } from '../../src/coach/kg/lookupKgNode';

const getLine = vi.fn();
const getOpening = vi.fn();
const getFamily = vi.fn();
const getVariation = vi.fn();

vi.mock('../../src/storage', () => ({
  getRepository: () => ({
    getLine,
    getOpening,
    getFamily,
    getVariation,
  }),
}));

describe('lookupKgNode', () => {
  it('returns a rendered opening node for a valid line id', async () => {
    getLine.mockResolvedValue({
      id: 'line-1',
      opening_id: 'op-1',
      variation_id: 'var-1',
      tags: ['mainline', 'open'],
    });
    getOpening.mockResolvedValue({ id: 'op-1', name: 'Italian Game', family_id: 'fam-1' });
    getFamily.mockResolvedValue({ id: 'fam-1', name: 'Open Games' });
    getVariation.mockResolvedValue({ id: 'var-1', name: 'Giuoco Pianissimo' });
    const node = await lookupKgNode('line-1');
    expect(node?.openingName).toBe('Italian Game');
    const block = renderKgBlock(node);
    expect(block).toContain('opening: Italian Game');
    expect(block).toContain('variation: Giuoco Pianissimo');
  });

  it('returns null when line is missing', async () => {
    getLine.mockResolvedValue(null);
    await expect(lookupKgNode('missing')).resolves.toBeNull();
  });
});
