/**
 * JSON-backed implementation of OpeningRepository.
 *
 * Loads `/catalog.json` once via `fetch`, caches the parsed Catalog in
 * memory, and answers all queries from that cache.
 *
 * The fetch URL is configurable via constructor; default is `/catalog.json`
 * (served by Vite from `public/`).
 */

import type {
  Catalog,
  Line,
  Opening,
  OpeningRepository,
  SearchQuery,
} from './types';

const DEFAULT_CATALOG_URL = '/catalog.json';

export class JsonOpeningRepository implements OpeningRepository {
  private readonly url: string;
  private cachePromise: Promise<Catalog> | null = null;

  constructor(url: string = DEFAULT_CATALOG_URL) {
    this.url = url;
  }

  /** Force-reload the catalog (escape hatch for test setup or reload buttons). */
  reset(): void {
    this.cachePromise = null;
  }

  // -------------------------------------------------------------------------
  // OpeningRepository surface
  // -------------------------------------------------------------------------

  async listOpenings(): Promise<Opening[]> {
    const cat = await this.load();
    return cat.openings.slice();
  }

  async getOpening(id: string): Promise<Opening | null> {
    const cat = await this.load();
    return cat.openings.find((o) => o.id === id) ?? null;
  }

  async listLines(openingId: string): Promise<Line[]> {
    const cat = await this.load();
    return cat.lines.filter((l) => l.opening_id === openingId);
  }

  async getLine(id: string): Promise<Line | null> {
    const cat = await this.load();
    return cat.lines.find((l) => l.id === id) ?? null;
  }

  async searchLines(query: SearchQuery): Promise<Line[]> {
    const cat = await this.load();
    return cat.lines.filter((line) => {
      if (query.color !== undefined) {
        const opening = cat.openings.find((o) => o.id === line.opening_id);
        if (!opening || opening.color !== query.color) return false;
      }
      if (query.eco !== undefined) {
        const opening = cat.openings.find((o) => o.id === line.opening_id);
        if (!opening || !opening.eco.includes(query.eco)) return false;
      }
      if (query.tags && query.tags.length > 0) {
        const lineTags = new Set(line.tags);
        if (!query.tags.every((t) => lineTags.has(t))) return false;
      }
      return true;
    });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private load(): Promise<Catalog> {
    if (this.cachePromise === null) {
      this.cachePromise = this.fetchAndValidate();
    }
    return this.cachePromise;
  }

  private async fetchAndValidate(): Promise<Catalog> {
    const resp = await fetch(this.url);
    if (!resp.ok) {
      throw new Error(`Failed to load catalog from ${this.url}: HTTP ${resp.status}`);
    }
    const raw: unknown = await resp.json();
    if (!isCatalog(raw)) {
      throw new Error(`Catalog at ${this.url} failed schema validation`);
    }
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Schema validator (lightweight — checks shape, not every field)
// ---------------------------------------------------------------------------

function isCatalog(value: unknown): value is Catalog {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.version === 'string' &&
    Array.isArray(v.openings) &&
    Array.isArray(v.lines) &&
    v.openings.every(isOpening) &&
    v.lines.every(isLine)
  );
}

function isOpening(value: unknown): value is Opening {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.eco === 'string' &&
    (v.color === 'white' || v.color === 'black') &&
    Array.isArray(v.line_ids) &&
    v.line_ids.every((id: unknown) => typeof id === 'string')
  );
}

function isLine(value: unknown): value is Line {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.opening_id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.moves) &&
    v.moves.every((m: unknown) => typeof m === 'string') &&
    typeof v.depth === 'number' &&
    typeof v.end_fen === 'string' &&
    typeof v.popularity === 'number'
  );
}
