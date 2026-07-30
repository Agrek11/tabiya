import type { CitationPayload } from './CitationValidator';

export type StructuredCoachResponse = CitationPayload & {
  prose?: string;
};

function asStructuredCoachResponse(v: unknown): StructuredCoachResponse | null {
  if (!v || typeof v !== 'object') return null;
  const obj = v as Record<string, unknown>;
  const pick = (k: string): string[] | undefined => {
    const raw = obj[k];
    if (!Array.isArray(raw)) return undefined;
    return raw.filter((x): x is string => typeof x === 'string');
  };
  const prose = typeof obj.prose === 'string' ? obj.prose.trim() : undefined;
  const out: StructuredCoachResponse = {
    prose: prose && prose.length > 0 ? prose : undefined,
    tags_cited: pick('tags_cited'),
    motifs_cited: pick('motifs_cited'),
    features_cited: pick('features_cited'),
  };
  if (!out.prose && !out.tags_cited && !out.motifs_cited && !out.features_cited) return null;
  return out;
}

function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return null;
}

/**
 * Best-effort extraction of optional structured citation payload from model
 * output. Returns null for plain prose outputs.
 */
export function parseStructuredResponse(text: string): StructuredCoachResponse | null {
  const block = extractJsonBlock(text);
  if (!block) return null;
  try {
    const parsed = JSON.parse(block) as unknown;
    return asStructuredCoachResponse(parsed);
  } catch {
    return null;
  }
}
