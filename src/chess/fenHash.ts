/**
 * fenHash — TypeScript mirror of `scripts/tabiya_build/transposition.py`.
 *
 * Two outputs the build pipeline and the browser must agree on byte-for-byte:
 *   - `normalizeFen(fen)`: keeps the first 4 FEN fields (piece placement,
 *     side to move, castling rights, en-passant target square). Drops the
 *     halfmove + fullmove counters. This is what allows
 *     "same position, different move number" transpositions to collide.
 *   - `fenHash(fen)`: SHA-1 of the normalized FEN, first 16 hex chars.
 *
 * Contract test: `tests/fen-hash.test.ts` consumes the Phase 7 parity
 * fixture (Phase 2a `tests/fixtures/fen_hash_parity.json`) and asserts
 * byte-equal output. Drift fails CI in both Python and TS suites.
 *
 * Article 11 (local-first): uses `crypto.subtle.digest` from the browser
 *   Web Crypto API — no remote call.
 * Article 14 (type discipline): strict TS, no `any`.
 */

/** Drop halfmove + fullmove counters from a FEN; keep first 4 fields. */
export function normalizeFen(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/**
 * SHA-1 of the normalized FEN, first 16 hex chars. Mirrors Python:
 *   hashlib.sha1(normalize_fen(fen).encode()).hexdigest()[:16]
 */
export async function fenHash(fen: string): Promise<string> {
  const normalized = normalizeFen(fen);
  // Web Crypto requires a Uint8Array; encode the normalized string as UTF-8.
  const data = new TextEncoder().encode(normalized);
  const buf = await crypto.subtle.digest('SHA-1', data);
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < 8; i += 1) {
    // SHA-1 returns 20 bytes (40 hex chars); we want first 16 hex chars = 8 bytes.
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}
