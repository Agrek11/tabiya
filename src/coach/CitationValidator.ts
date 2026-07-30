/**
 * CitationValidator — 4e post-check for structured LLM citations.
 *
 * The validator is intentionally conservative:
 * - If no structured payload is present, we do not fail closed (4a/4b clients
 *   still return prose-only responses).
 * - When structured citations are present, each cited token must be traceable
 *   to either the VERIFIED FACTS block or engine block.
 */

import type { LLMResponse } from './LLMClient';

export type CitationPayload = {
  tags_cited?: string[];
  motifs_cited?: string[];
  features_cited?: string[];
};

export type CitationValidation = {
  ok: boolean;
  checked: boolean;
  missing: string[];
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function payloadFromResponse(llm: LLMResponse): CitationPayload | null {
  const parsed = llm.parsed;
  if (!parsed) return null;
  return {
    tags_cited: parsed.tags_cited ?? [],
    motifs_cited: parsed.motifs_cited ?? [],
    features_cited: parsed.features_cited ?? [],
  };
}

export function validateCitations(
  llm: LLMResponse,
  inputs: { featuresBlock: string; engineBlock: string },
): CitationValidation {
  const payload = payloadFromResponse(llm);
  if (!payload) return { ok: true, checked: false, missing: [] };
  const haystack = normalize(`${inputs.featuresBlock}\n${inputs.engineBlock}`);
  const cited = [
    ...(payload.tags_cited ?? []),
    ...(payload.motifs_cited ?? []),
    ...(payload.features_cited ?? []),
  ]
    .map(normalize)
    .filter((s) => s.length > 0);
  const missing = cited.filter((token) => !haystack.includes(token));
  return { ok: missing.length === 0, checked: true, missing };
}
