import type { Line } from '../storage/types';

export type GhostLineRecord = Line & {
  source: 'ghost';
  game_id: string;
  origin_ply: number;
  parent_line_id: string | null;
  cp_loss: number;
  created_at: number;
};
