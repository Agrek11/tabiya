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

// --- 4c.1 validated motifs --------------------------------------------------

export type MotifConfidence = 'high' | 'speculative';

export interface ForkMotif {
  by: string;
  targets: string[];
  confidence: MotifConfidence;
}
export interface SkewerMotif {
  by: string;
  front: string;
  back: string;
  confidence: MotifConfidence;
}
export interface BatteryMotif {
  pieces: string[];
  target: string;
  confidence: MotifConfidence;
}
export interface PinMotif {
  by: string;
  pinned: string;
  to: string;
  kind: 'absolute' | 'relative';
  confidence: MotifConfidence;
}
export interface RemovingDefenderMotif {
  defender: string;
  abandons: string[];
  confidence: MotifConfidence;
}
export interface HangingMotif {
  piece: string;
  by: string;
  confidence: MotifConfidence;
}

export interface MotifFeatures {
  forks: ForkMotif[];
  skewers: SkewerMotif[];
  batteries: BatteryMotif[];
  pins: PinMotif[];
  removing_defender: RemovingDefenderMotif[];
  hanging: HangingMotif[];
}

// --- 4c.2 position classification ------------------------------------------

export type CenterType = 'open' | 'closed' | 'fixed' | 'tension' | 'fluid';

export interface CenterClassification {
  type: CenterType;
  open_files_central: string[];
  space_edge: Side | null;
}

export interface ClassificationFeatures {
  center: CenterClassification;
  /** Named pawn structures, exact-match only (may be empty). */
  structures: string[];
  character: 'open-tactical' | 'closed-maneuvering' | 'balanced' | 'sharp-imbalanced';
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
  /** 4c.1 — validated, named motifs (optional: absent on pre-v4 sidecars). */
  motifs?: MotifFeatures;
  /** 4c.2 — center type + named structures (optional: absent pre-v5). */
  classification?: ClassificationFeatures;
}

export interface FeaturesSidecar {
  schema_version: number;
  extractor_version: number;
  generated_at: string;
  index: Record<string, PositionFeatures>;
}

/** Sidecar schema version this client understands (mirror of Python). */
export const FEATURES_SCHEMA_VERSION = 1;
