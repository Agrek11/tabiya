/**
 * Repository interface and DTOs for the opening catalog.
 *
 * Mirrors `scripts/tabiya_build/schema.py` 1:1. Constitution Article 5 —
 * consumers depend on `OpeningRepository`, never on a concrete implementation.
 */

export type Color = 'white' | 'black';
export type Side = 'white' | 'black' | 'both';
export type FamilyCategory =
  | 'open'
  | 'semi-open'
  | 'closed'
  | 'indian'
  | 'flank'
  | 'gambit'
  | 'uncategorized';

/** Strategic role of a key square — drives spotlight color encoding. */
export type LineKeySquareRole =
  | 'outpost'
  | 'weak'
  | 'target'
  | 'break'
  | 'tension'
  | 'control'
  | 'pivot';

export type KeySquare = {
  square: string;
  note: string;
  side?: Side;
  role?: LineKeySquareRole;
};

// Re-export Phase 2a OpeningKeySquare type so Opening's optional field has a
// concrete shape without a circular import. See src/types/keySquares.ts.
export type {
  OpeningKeySquare,
  KeySquareRole,
  KeySquareForColor,
} from '../types/keySquares';
import type { OpeningKeySquare as _OpeningKeySquare } from '../types/keySquares';

export type ForkAnnotation = {
  ply_index: number;
  alternatives: string[];
  label: string;
  rationale?: string;
};

// ---------------------------------------------------------------------------
// Phase 1b — Explain Mode types (R2)
// ---------------------------------------------------------------------------

export type ArrowColor = 'green' | 'red' | 'blue';

export type Arrow = {
  from: string; // algebraic square e.g. "e2"
  to: string; // algebraic square e.g. "e4"
  color?: ArrowColor; // default 'green'
};

export type HighlightIntent = 'focus' | 'threat' | 'support';

export type HighlightSquare = {
  square: string; // e.g. "d5"
  intent?: HighlightIntent; // styling hint
};

/**
 * Per-ply "why this move" payload. Loaded as a sidecar from
 * `public/explain/<lineId>.json` on Explain Mode entry. When attached to a
 * `Line.explain` array, `explain.length === moves.length` (one block per ply).
 */
export type ExplainBlock = {
  rationale: string; // 1-3 sentence "why this move"
  arrows?: Arrow[];
  highlights?: HighlightSquare[];
  threats?: string; // optional 2nd-pass deeper note (e.g., "If ...Nxe4 then Re1 pins")
  pauseMs?: number; // default 2500; per-move override
};

export type Line = {
  id: string;
  opening_id: string;
  variation_id: string;
  name: string;
  moves: string[];           // SAN (Constitution Article 9)
  depth: number;             // ply count
  end_fen: string;
  popularity: number;
  tags: string[];
  strategic_notes: string[];
  key_squares: KeySquare[];
  forks: ForkAnnotation[];
  /**
   * Phase 1b — optional per-ply explain blocks, hydrated from sidecar on
   * Explain Mode entry. When present, length matches `moves`. The sidecar
   * itself lives at `public/explain/<id>.json` and is fetched lazily by
   * `useExplainContent` — this field on `Line` is the in-memory landing zone.
   */
  explain?: ExplainBlock[];
};

export type Opening = {
  id: string;
  family_id: string;
  name: string;
  eco: string;
  color: Color;
  line_ids: string[];
  is_gambit: boolean;
  /**
   * Phase 2a — curated key-squares for the canonical opening position.
   * Optional and additive (Article 5 / R4.4) — frontend graceful-degrades
   * when absent or empty (R6.6). Loaded as part of `catalog.json`.
   */
  key_squares?: _OpeningKeySquare[];
};

export type Family = {
  id: string;
  name: string;
  category: FamilyCategory;
  eco_range: string;
  tier: 1 | 2 | 3;
  opening_ids: string[];
};

export type Variation = {
  id: string;
  family_id: string;
  name: string;
  eco: string;
  color: Color;
  trunk_moves: string[];
  line_ids: string[];
};

export type Preset = {
  id: string;
  name: string;
  description: string;
  tier_band: number[];
  family_ids: string[];
  /**
   * Phase 1.5 — optional explicit member line IDs. When non-empty, authoritative.
   * When empty/absent, legacy `tier_band` + `family_ids` derivation is used.
   * Optional in TS so older catalogs (schema_version 2) still parse.
   */
  lines?: string[];
  recommended_color: 'white-only' | 'black-only' | 'both';
};

export type Catalog = {
  version: string;
  /**
   * Phase 1b — content/schema generation marker. Bumped 1 → 2 when the
   * `explain` sidecar feature lands. Optional in TS so older catalogs still
   * parse (graceful degrade per Article 5); the loader logs a warning on
   * mismatch but never throws.
   */
  schema_version?: number;
  families: Family[];
  variations: Variation[];
  openings: Opening[];
  lines: Line[];
  presets?: Preset[];
};

export type SearchQuery = {
  color?: Color;
  eco?: string;
  tags?: string[];
};

// ---------------------------------------------------------------------------
// Phase 1 — SRS data layer
// ---------------------------------------------------------------------------

export type SrsBox = 1 | 2 | 3 | 4 | 5;

export type SrsState = {
  line_id: string;
  box: SrsBox;
  last_reviewed: string;            // ISO 8601
  attempts: number;                 // ≥ 1
  wrong_attempts_total: number;
  hint_uses_total: number;
};

export type DrillResult = {
  wrong_attempts: number;
  hint_uses: number;
  duration_ms: number;
  completed_at: string;             // ISO 8601
};

/** Source of truth for box review intervals (Phase 1 spec R2.4). */
export const BOX_INTERVALS_DAYS: Readonly<Record<SrsBox, number>> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

export interface SrsRepository {
  getState(lineId: string): Promise<SrsState | null>;
  listAllStates(): Promise<SrsState[]>;
  recordDrillResult(lineId: string, result: DrillResult): Promise<SrsState>;
  resetState(lineId: string): Promise<void>;
  resetAll(): Promise<void>;
}

/**
 * Repository surface — the only way any consumer reads catalog data.
 * v1 implementation: JsonOpeningRepository (bundled `/catalog.json`).
 * v2: SqliteOpeningRepository (deferred).
 */
export interface OpeningRepository {
  listOpenings(): Promise<Opening[]>;
  getOpening(id: string): Promise<Opening | null>;
  listLines(openingId: string): Promise<Line[]>;
  getLine(id: string): Promise<Line | null>;
  searchLines(query: SearchQuery): Promise<Line[]>;

  // Phase 0d.3 — Family layer
  listFamilies(): Promise<Family[]>;
  getFamily(id: string): Promise<Family | null>;
  listOpeningsByFamily(familyId: string): Promise<Opening[]>;
  listGambits(): Promise<Opening[]>;

  // Curated v2 — Variation layer
  listVariations(): Promise<Variation[]>;
  getVariation(id: string): Promise<Variation | null>;
  listVariationsByFamily(familyId: string): Promise<Variation[]>;
  listLinesByVariation(variationId: string): Promise<Line[]>;

  // Phase 1c — Preset layer
  listPresets(): Promise<Preset[]>;
  getPreset(id: string): Promise<Preset | null>;
}
