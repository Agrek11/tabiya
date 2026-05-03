/**
 * Hardcoded sample opening line for the Phase 0a skeleton.
 *
 * Single linear line in SAN format (Constitution Article 9). Public opening
 * only — no personal repertoire baked in (Article 10). The catalog system
 * (Phase 0b) replaces this with a JSON-loaded catalog, but for the skeleton
 * we ship one line statically to validate the drill mechanic.
 */

export const SAMPLE_LINE_NAME = 'Ruy Lopez (skeleton sample)';

export const SAMPLE_LINE_SAN: readonly string[] = [
  'e4',  // 1. White
  'e5',  // 1. Black
  'Nf3', // 2. White
  'Nc6', // 2. Black
  'Bb5', // 3. White
] as const;
