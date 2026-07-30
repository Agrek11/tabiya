import type { BlunderDnaCluster } from './blunderDna';

export type StudyRecommendation = {
  key: string;
  title: string;
  reason: string;
  resource: string;
  url: string;
};

const RECOMMENDATION_MAP: Record<string, Omit<StudyRecommendation, 'reason'>> = {
  'edge-or-wing-pawn-push': {
    key: 'edge-or-wing-pawn-push',
    title: 'Pawn discipline in the opening',
    resource: 'Chessable: Opening Principles - Pawn Moves',
    url: 'https://www.chessable.com/',
  },
  'early-queen-commit': {
    key: 'early-queen-commit',
    title: 'Avoid premature queen development',
    resource: 'Lichess Study: Opening Principles',
    url: 'https://lichess.org/study',
  },
  'missed-castling-window': {
    key: 'missed-castling-window',
    title: 'King safety and castling timing',
    resource: 'Hanging Pawns: King Safety videos',
    url: 'https://www.youtube.com/@HangingPawns',
  },
  'speculative-capture': {
    key: 'speculative-capture',
    title: 'Candidate moves before captures',
    resource: 'Chess Tempo tactics mixed mode',
    url: 'https://chesstempo.com/',
  },
  'missed-tactical-capture': {
    key: 'missed-tactical-capture',
    title: 'Forcing move scan (checks/captures/threats)',
    resource: 'Lichess Puzzle Dashboard',
    url: 'https://lichess.org/training/dashboard/30',
  },
  'general-calculation-slip': {
    key: 'general-calculation-slip',
    title: 'Calculation hygiene',
    resource: 'Woodpecker-style repetition',
    url: 'https://www.chessable.com/',
  },
};

export function recommendationsFromDna(dna: BlunderDnaCluster[]): StudyRecommendation[] {
  return dna.slice(0, 3).map((cluster) => {
    const rec = RECOMMENDATION_MAP[cluster.key] || {
      key: 'general-calculation-slip',
      title: 'Calculation hygiene',
      resource: 'Woodpecker-style repetition',
      url: 'https://www.chessable.com/',
    };
    return {
      ...rec,
      reason: `${cluster.label} appears ${cluster.count} time${cluster.count === 1 ? '' : 's'} in your ghost blunders.`,
    };
  });
}
