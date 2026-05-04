/**
 * Piece set tests — renderer factory + persistence.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PIECE_SETS,
  buildPieceRenderObject,
  readPieceSet,
  writePieceSet,
  type PieceSetId,
} from '../src/theme/pieceSets';

const KEY = 'tabiya.pieceSet';

describe('pieceSets', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('exposes 3 preset options including default', () => {
    expect(PIECE_SETS.length).toBe(3);
    const ids = PIECE_SETS.map((p) => p.id);
    expect(ids).toContain('default');
    expect(ids).toContain('letter');
    expect(ids).toContain('symbol');
  });

  it('readPieceSet returns "default" on empty localStorage', () => {
    expect(readPieceSet()).toBe('default');
  });

  it('readPieceSet rejects invalid stored values', () => {
    window.localStorage.setItem(KEY, 'not-a-set');
    expect(readPieceSet()).toBe('default');
  });

  it('round-trips writePieceSet → readPieceSet', () => {
    const ids: PieceSetId[] = ['default', 'letter', 'symbol'];
    for (const id of ids) {
      writePieceSet(id);
      expect(readPieceSet()).toBe(id);
    }
  });

  it('buildPieceRenderObject returns undefined for default (library renders)', () => {
    expect(buildPieceRenderObject('default')).toBeUndefined();
  });

  it('buildPieceRenderObject returns 12 piece renderers for letter set', () => {
    const obj = buildPieceRenderObject('letter');
    expect(obj).toBeDefined();
    if (!obj) return;
    const fenChars = ['P', 'N', 'B', 'R', 'Q', 'K', 'p', 'n', 'b', 'r', 'q', 'k'];
    for (const c of fenChars) {
      expect(typeof obj[c]).toBe('function');
    }
  });

  it('buildPieceRenderObject returns 12 piece renderers for symbol set', () => {
    const obj = buildPieceRenderObject('symbol');
    expect(obj).toBeDefined();
    if (!obj) return;
    expect(Object.keys(obj).length).toBe(12);
  });
});
