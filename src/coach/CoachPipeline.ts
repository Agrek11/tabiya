/**
 * CoachPipeline — the single Coach entry point (Task 7.4, Design §7).
 *
 *   engine analysis → CoachContext → (optional) LLM narration
 *
 * Degraded-by-default (Article 11): if the engine fails to load the result
 * carries `engine: null` + `error: 'engine-unavailable'`; if the LLM is
 * unconfigured or errors, `llm` is simply undefined. The pipeline NEVER throws
 * for those cases, so surfaces need no try/catch. `promptVersion` is logged for
 * eval traceability (Article 4).
 */

import { loadStockfishEngine } from '../engine/engineLoader';
import { getEnginePreset, loadPresetFromStorage, type EnginePresetName } from '../engine/presets';
import type { EngineAnalysis } from '../engine/ChessEngine';
import { CoachContextBuilder } from './CoachContextBuilder';
import type { PlyHistoryEntry } from './CoachContext';
import { getLLMClient } from './container';
import type { LLMResponse } from './LLMClient';
import promptV1Raw from '../../prompts/coach/v1.txt?raw';

export const PROMPT_VERSION = 'v1' as const;

export type CoachRunInput = {
  fen: string;
  /** Full ply history so far (oldest → newest); builder caps to last 6. */
  history: PlyHistoryEntry[];
  lineId?: string;
  plyIndex?: number;
  /** Override the persisted preset (mostly for tests). */
  enginePresetName?: EnginePresetName;
  abortSignal?: AbortSignal;
};

export type CoachResult = {
  engine: EngineAnalysis | null;
  llm?: LLMResponse;
  promptVersion: typeof PROMPT_VERSION;
  error?: 'engine-unavailable';
};

// --- prompt template (parsed once) -----------------------------------------

const { systemPrompt, userTemplate } = parseTemplate(promptV1Raw);

function parseTemplate(raw: string): { systemPrompt: string; userTemplate: string } {
  const sysMarker = '===SYSTEM===';
  const userMarker = '===USER===';
  const sysStart = raw.indexOf(sysMarker);
  const userStart = raw.indexOf(userMarker);
  const systemPrompt = raw.slice(sysStart + sysMarker.length, userStart).trim();
  const userTemplate = raw.slice(userStart + userMarker.length).trim();
  return { systemPrompt, userTemplate };
}

// --- rendering helpers (exported for tests) --------------------------------

/** Centipawn (side-to-move POV) → "+0.32" / "-1.05" / "#3" / "#-2". */
export function formatEval(scoreCp: number, mateIn?: number): string {
  if (mateIn !== undefined) return `#${mateIn}`;
  const pawns = scoreCp / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

export function renderEngineBlock(engine: EngineAnalysis): string {
  const best = `Best: ${engine.bestmove} (${formatEval(engine.pvs[0]?.scoreCp ?? 0, engine.pvs[0]?.mateIn)}) at depth ${engine.engineDepth}`;
  const lines = engine.pvs.map((pv, i) => {
    const seq = pv.moves.slice(0, 6).join(' ');
    return `PV ${i + 1}: ${seq}  ${formatEval(pv.scoreCp, pv.mateIn)}  d${pv.depth}`;
  });
  return [best, ...lines].join('\n');
}

export function renderPliesBlock(history: PlyHistoryEntry[]): string {
  if (history.length === 0) return '(start of line)';
  return history.map((p) => `${p.plyIndex + 1}. ${p.color === 'w' ? 'White' : 'Black'} ${p.san}`).join('\n');
}

function renderUserPrompt(
  template: string,
  vars: { engine_block: string; recent_plies_block: string; engine_preset_name: string },
): string {
  return template
    .replaceAll('{{engine_block}}', vars.engine_block)
    .replaceAll('{{recent_plies_block}}', vars.recent_plies_block)
    .replaceAll('{{engine_preset_name}}', vars.engine_preset_name);
}

// --- pipeline --------------------------------------------------------------

export const CoachPipeline = {
  async run(input: CoachRunInput): Promise<CoachResult> {
    const presetName = input.enginePresetName ?? loadPresetFromStorage();
    const opts = { ...getEnginePreset(presetName), signal: input.abortSignal };

    // Step 1 — engine (hard dependency; failure → engine-unavailable).
    let engine: EngineAnalysis;
    try {
      const sf = await loadStockfishEngine();
      engine = await sf.analyze(input.fen, opts);
    } catch {
      return { engine: null, promptVersion: PROMPT_VERSION, error: 'engine-unavailable' };
    }

    // Step 2 — context.
    const ctx = CoachContextBuilder.build({
      engine,
      history: input.history,
      enginePresetName: presetName,
      lineId: input.lineId,
      plyIndex: input.plyIndex,
    });

    // Step 3 — optional LLM narration (degraded path = llm undefined).
    let llm: LLMResponse | undefined;
    const client = getLLMClient();
    if (client) {
      try {
        if (await client.available()) {
          const userPrompt = renderUserPrompt(userTemplate, {
            engine_block: renderEngineBlock(ctx.engine),
            recent_plies_block: renderPliesBlock(ctx.history),
            engine_preset_name: ctx.enginePresetName,
          });
          llm = await client.complete({ systemPrompt, userPrompt, maxTokens: 400, temperature: 0.6 });
        }
      } catch (err) {
        // Article 11 — narration failure must not break the surface.
        if (import.meta.env.DEV) console.warn('[coach] LLM narration failed; engine-only:', err);
        llm = undefined;
      }
    }

    if (import.meta.env.DEV) console.debug('[coach] promptVersion', PROMPT_VERSION);
    return { engine, llm, promptVersion: PROMPT_VERSION };
  },
};
