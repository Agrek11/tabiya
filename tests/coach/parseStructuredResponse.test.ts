import { describe, expect, it } from 'vitest';
import { parseStructuredResponse } from '../../src/coach/parseStructuredResponse';

describe('parseStructuredResponse', () => {
  it('parses object with prose and citations', () => {
    const text = JSON.stringify({
      prose: 'Use d3 to keep options flexible.',
      tags_cited: ['relative pin'],
      motifs_cited: ['pin'],
      features_cited: ['open d-file'],
    });
    expect(parseStructuredResponse(text)).toEqual({
      prose: 'Use d3 to keep options flexible.',
      tags_cited: ['relative pin'],
      motifs_cited: ['pin'],
      features_cited: ['open d-file'],
    });
  });

  it('parses fenced json payload', () => {
    const text = [
      'Explanation text.',
      '```json',
      '{"tags_cited":["iqp"],"motifs_cited":["fork"],"features_cited":["space"]}',
      '```',
    ].join('\n');
    expect(parseStructuredResponse(text)).toEqual({
      tags_cited: ['iqp'],
      motifs_cited: ['fork'],
      features_cited: ['space'],
    });
  });

  it('returns null for plain prose', () => {
    expect(parseStructuredResponse('No JSON here.')).toBeNull();
  });
});
