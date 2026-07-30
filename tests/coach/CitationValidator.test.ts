import { describe, expect, it } from 'vitest';
import { validateCitations } from '../../src/coach/CitationValidator';
import type { LLMResponse } from '../../src/coach/LLMClient';

describe('validateCitations', () => {
  it('passes through prose-only responses', () => {
    const llm: LLMResponse = { text: 'ok', modelName: 'm' };
    const out = validateCitations(llm, { featuresBlock: 'foo', engineBlock: 'bar' });
    expect(out.ok).toBe(true);
    expect(out.checked).toBe(false);
  });

  it('fails when structured citations are missing from context', () => {
    const llm: LLMResponse = {
      text: 'ok',
      modelName: 'm',
      parsed: { tags_cited: ['iqp'], motifs_cited: ['fork'], features_cited: ['space advantage'] },
    };
    const out = validateCitations(llm, { featuresBlock: 'open center', engineBlock: 'PV 1: e4 e5' });
    expect(out.ok).toBe(false);
    expect(out.checked).toBe(true);
    expect(out.missing.length).toBe(3);
  });

  it('passes when structured citations are present in context', () => {
    const llm: LLMResponse = {
      text: 'ok',
      modelName: 'm',
      parsed: { tags_cited: ['iqp'], motifs_cited: ['fork'], features_cited: ['space advantage'] },
    };
    const out = validateCitations(llm, {
      featuresBlock: 'white has iqp; white space advantage',
      engineBlock: 'PV 1: Nf3 Nc6 // possible fork on e5',
    });
    expect(out.ok).toBe(true);
    expect(out.checked).toBe(true);
  });
});
