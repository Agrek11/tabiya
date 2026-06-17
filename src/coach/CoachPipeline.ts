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
import { SidecarFeatureExtractor } from './features/SidecarFeatureExtractor';
import type { FeatureExtractor } from './features/FeatureExtractor';
import { renderFeaturesBlock } from './features/renderFeaturesBlock';
import promptV1Raw from '../../prompts/coach/v1.txt?raw';
import promptV2Raw from '../../prompts/coach/v2.txt?raw';

export type PromptVersion = 'v1' | 'v2';

/** Module-level singleton; swappable for tests. */
let featureExtractor: FeatureExtractor = new SidecarFeatureExtractor();
export function _setFeatureExtractorForTesting(fx: FeatureExtractor): void {
  featureExtractor = fx;
}

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
  promptVersion: PromptVersion;
  error?: 'engine-unavailable';
};

// --- prompt templates (parsed once) ----------------------------------------

const V1 = parseTemplate(promptV1Raw);
const V2 = parseTemplate(promptV2Raw);

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
  vars: {
    engine_block: string;
    recent_plies_block: string;
    engine_preset_name: string;
    features_block?: string;
  },
): string {
  return template
    .replaceAll('{{engine_block}}', vars.engine_block)
    .replaceAll('{{recent_plies_block}}', vars.recent_plies_block)
    .replaceAll('{{engine_preset_name}}', vars.engine_preset_name)
    .replaceAll('{{features_block}}', vars.features_block ?? '');
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
      return { engine: null, promptVersion: 'v1', error: 'engine-unavailable' };
    }

    // Step 2 — features (4b): precomputed lookup; null = off-book → v1 path.
    // Never throws (extractor degrades to null on any failure, Article 11).
    let features: Awaited<ReturnType<FeatureExtractor['extract']>>;
    try {
      features = await featureExtractor.extract(input.fen);
    } catch {
      features = null;
    }

    // Step 3 — context.
    const ctx = CoachContextBuilder.build({
      engine,
      history: input.history,
      enginePresetName: presetName,
      lineId: input.lineId,
      plyIndex: input.plyIndex,
      features,
    });

    // Prompt selection: v2 when we have a non-empty features block, else v1.
    const featuresBlock = ctx.features ? renderFeaturesBlock(ctx.features) : '';
    const useV2 = featuresBlock.length > 0;
    const tpl = useV2 ? V2 : V1;
    const promptVersion: PromptVersion = useV2 ? 'v2' : 'v1';

    // Step 4 — optional LLM narration (degraded path = llm undefined).
    let llm: LLMResponse | undefined;
    const client = getLLMClient();
    if (client) {
      try {
        if (await client.available()) {
          const userPrompt = renderUserPrompt(tpl.userTemplate, {
            engine_block: renderEngineBlock(ctx.engine),
            recent_plies_block: renderPliesBlock(ctx.history),
            engine_preset_name: ctx.enginePresetName,
            features_block: useV2 ? featuresBlock : undefined,
          });
          llm = await client.complete({
            systemPrompt: tpl.systemPrompt,
            userPrompt,
            maxTokens: 400,
            temperature: 0.6,
          });
        }
      } catch (err) {
        // Article 11 — narration failure must not break the surface.
        if (import.meta.env.DEV) console.warn('[coach] LLM narration failed; engine-only:', err);
        llm = undefined;
      }
    }

    if (import.meta.env.DEV) console.debug('[coach] promptVersion', promptVersion);
    return { engine, llm, promptVersion };
  },
};
