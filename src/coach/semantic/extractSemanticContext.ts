import type { EngineAnalysis } from '../../engine/ChessEngine';

export type MovePurpose =
  | 'develop'
  | 'capture'
  | 'castle'
  | 'check'
  | 'central-break'
  | 'improve-king-safety'
  | 'other';

export type SemanticContext = {
  purposes: MovePurpose[];
  shortPlan: string[];
};

function classifyBestMoveSan(san: string): MovePurpose[] {
  const out = new Set<MovePurpose>();
  const cleanedSan = san.replace(/[+#?!]/g, '');
  if (san.includes('x')) out.add('capture');
  if (san === 'O-O' || san === 'O-O-O') {
    out.add('castle');
    out.add('improve-king-safety');
  }
  if (san.includes('+') || san.includes('#')) out.add('check');
  if (/^[NBRQ]/.test(san)) out.add('develop');
  if (/^[de]x?[a-h]?[45]/.test(cleanedSan)) out.add('central-break');
  if (out.size === 0) out.add('other');
  return [...out];
}

function planFromPv(engine: EngineAnalysis): string[] {
  const pv = engine.pvs[0]?.moves ?? [];
  if (pv.length === 0) return [];
  const first = pv[0]!;
  const second = pv[1];
  const third = pv[2];
  const out: string[] = [`Best line starts with ${first}.`];
  if (second) out.push(`Likely reply: ${second}.`);
  if (third) out.push(`Follow-up idea: ${third}.`);
  return out;
}

export function extractSemanticContext(engine: EngineAnalysis): SemanticContext {
  const best = engine.bestmove || engine.pvs[0]?.moves[0] || '';
  return {
    purposes: best ? classifyBestMoveSan(best) : ['other'],
    shortPlan: planFromPv(engine),
  };
}

export function renderSemanticBlock(ctx: SemanticContext): string {
  const tags = ctx.purposes.join(', ');
  const plan = ctx.shortPlan.join(' ');
  return `MOVE PURPOSE TAGS\n${tags}\n\nPLAN HINTS\n${plan || '(none)'}`;
}
