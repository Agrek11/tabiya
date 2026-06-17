/**
 * PositionFeatures — TS mirror of the Python build-time extractor output
 * (Phase 4b, design-4b §schema). Shipped in `public/features.json` keyed by
 * normalized-FEN sha1-16 hash; consumed read-only by the Coach.
 *
 * Kept structurally loose where the Python side emits provider-shaped maps
 * (mobility, occupancy) — the narrator reads these, it does not compute them.
 */

export type Side = 'white' | 'black';
export type PerSide<T> = { white: T; black: T };

export interface MaterialFeatures {
  balance_cp: number;
  imbalance: string; // "none" | "R+P vs B+N" | ...
  bishop_pair: PerSide<boolean>;
}

export interface PawnChain {
  base: string;
  head: string;
}

export interface PawnFeatures {
  doubled: PerSide<string[]>;
  isolated: PerSide<string[]>;
  backward: PerSide<string[]>;
  passed: PerSide<string[]>;
  candidate_passers: PerSide<string[]>;
  islands: PerSide<number>;
  chains: PerSide<PawnChain[]>;
  majorities: { queenside: Side | null; kingside: Side | null; center: Side | null };
  iqp: Side | null;
  hanging_duo: Side | null;
}

export interface KingSafetySide {
  castled: 'short' | 'long' | 'none';
  shield: 'intact' | 'one-breach' | 'shattered' | 'n/a';
  adjacent_open_files: string[];
  adjacent_half_open_files: string[];
  king_zone_attackers: number;
}

export interface CenterSpaceFeatures {
  center_occupancy: Record<string, string | null>;
  center_attacks: PerSide<number>;
  space: PerSide<number>;
  locked_center: boolean;
}

export interface FilesDiagonalsFeatures {
  open_files: string[];
  half_open: PerSide<string[]>;
  rooks_on_open: PerSide<string[]>;
  rooks_on_half_open: PerSide<string[]>;
  rook_on_seventh: PerSide<string[]>;
  long_diagonals: Record<string, Side | 'contested'>;
}

export interface OutpostSide {
  occupied: string[];
  available: string[];
}

export interface ActivityFeatures {
  mobility: PerSide<Record<string, number[]>>;
  outposts: PerSide<OutpostSide>;
  bad_bishop: PerSide<string | null>;
  fianchetto: PerSide<string | null>;
  trapped: PerSide<string[]>;
  undeveloped_minors: PerSide<number>;
  tempo: { side_to_move: Side; development_lead: string };
}

export interface PinFact {
  pinned: string;
  to: string;
  by: string;
  absolute: boolean;
}
export interface XrayFact {
  through: string;
  target: string;
  by: string;
}
export interface OverloadFact {
  piece: string;
  defends: string[];
}
export interface DiscoveredFact {
  mover: string;
  battery_piece: string;
  target: string;
}

export interface TacticsGeometryFeatures {
  pins: PinFact[];
  xrays: XrayFact[];
  overloaded: OverloadFact[];
  discovered_candidates: DiscoveredFact[];
  en_prise: string[];
}

export interface PositionFeatures {
  version: number;
  material: MaterialFeatures;
  pawns: PawnFeatures;
  king_safety: PerSide<KingSafetySide>;
  center_space: CenterSpaceFeatures;
  files_diagonals: FilesDiagonalsFeatures;
  activity: ActivityFeatures;
  tactics_geometry: TacticsGeometryFeatures;
}

export interface FeaturesSidecar {
  schema_version: number;
  extractor_version: number;
  generated_at: string;
  index: Record<string, PositionFeatures>;
}

/** Sidecar schema version this client understands (mirror of Python). */
export const FEATURES_SCHEMA_VERSION = 1;
