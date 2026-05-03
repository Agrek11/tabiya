/**
 * Repository interface and DTOs for the opening catalog.
 *
 * Mirrors `scripts/tabiya_build/schema.py` 1:1. Constitution Article 5 —
 * consumers depend on `OpeningRepository`, never on a concrete implementation.
 */

export type Color = 'white' | 'black';
export type Side = 'white' | 'black' | 'both';

export type KeySquare = {
  square: string;
  note: string;
  side?: Side;
};

export type Line = {
  id: string;
  opening_id: string;
  name: string;
  moves: string[];           // SAN (Constitution Article 9)
  depth: number;             // ply count
  end_fen: string;
  popularity: number;
  tags: string[];
  strategic_notes: string[];
  key_squares: KeySquare[];
};

export type Opening = {
  id: string;
  name: string;
  eco: string;
  color: Color;
  line_ids: string[];
};

export type Catalog = {
  version: string;
  openings: Opening[];
  lines: Line[];
};

export type SearchQuery = {
  color?: Color;
  eco?: string;
  tags?: string[];
};

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
}
