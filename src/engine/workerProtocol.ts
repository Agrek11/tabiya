import type { EngineAnalysis } from './ChessEngine';

export type EngineWorkerRequest =
  | { type: 'init' }
  | { type: 'analyze'; id: string; fen: string; opts: { depth?: number; multipv?: number; movetimeMs?: number; searchMovesSan?: string[] } }
  | { type: 'play'; id: string; fen: string; elo: number; movetimeMs?: number }
  | { type: 'cancel'; id: string }
  | { type: 'stop' };

export type EngineWorkerResponse =
  | { type: 'ready' }
  | { type: 'analysis'; id: string; analysis: EngineAnalysis }
  | { type: 'move'; id: string; bestmove: string }
  | { type: 'cancelled'; id: string }
  | { type: 'error'; id?: string; message: string };
