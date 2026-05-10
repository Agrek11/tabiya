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

export type KeySquare = {
  square: string;
  note: string;
  side?: Side;
};

export type ForkAnnotation = {
  ply_index: number;
  alternatives: string[];
  label: string;
  rationale?: string;
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
};

export type Opening = {
  id: string;
  family_id: string;
  name: string;
  eco: string;
  color: Color;
  line_ids: string[];
  is_gambit: boolean;
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

export type Catalog = {
  version: string;
  families: Family[];
  variations: Variation[];
  openings: Opening[];
  lines: Line[];
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
}
