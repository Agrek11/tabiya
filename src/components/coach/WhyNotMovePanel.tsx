import { useState } from 'react';
import { Chess } from 'chess.js';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { loadStockfishEngine } from '../../engine/engineLoader';
import { getEnginePreset, loadPresetFromStorage } from '../../engine/presets';
import { formatEval } from '../../coach/CoachPipeline';

type Props = {
  fenAtOOB: string;
  playedSAN: string;
  expectedSANs: string[];
};

function firstLegalSan(fen: string, sans: string[]): string | null {
  try {
    const b = new Chess(fen);
    for (const san of sans) {
      try {
        b.move(san);
        b.undo();
        return san;
      } catch {
        // try next candidate
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function WhyNotMovePanel({ fenAtOOB, playedSAN, expectedSANs }: Props): React.JSX.Element {
  const t = useTokens();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    playedEval: number;
    expectedEval: number;
    expectedSan: string;
  } | null>(null);

  async function runComparison(): Promise<void> {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const expectedSan = firstLegalSan(fenAtOOB, expectedSANs);
      if (!expectedSan) throw new Error('No legal expected book move available');
      if (!firstLegalSan(fenAtOOB, [playedSAN])) {
        throw new Error('Played SAN is not legal in this position');
      }
      const preset = getEnginePreset(loadPresetFromStorage());
      const sf = await loadStockfishEngine();
      const [played, expected] = await Promise.all([
        sf.analyze(fenAtOOB, { ...preset, multipv: 1, searchMovesSan: [playedSAN] }),
        sf.analyze(fenAtOOB, { ...preset, multipv: 1, searchMovesSan: [expectedSan] }),
      ]);
      const playedEval = played.pvs[0]?.scoreCp;
      const expectedEval = expected.pvs[0]?.scoreCp;
      if (playedEval === undefined || expectedEval === undefined) {
        throw new Error('Engine could not evaluate one of the candidate moves');
      }
      setResult({ playedEval, expectedEval, expectedSan });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={() => void runComparison()}
        disabled={loading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: t.surface,
          border: `0.5px solid ${t.border}`,
          borderRadius: 999,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: fonts.sans,
          color: t.ink,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        Why not this move?
      </button>
      {loading ? (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: t.inkSoft }}>Comparing continuations…</p>
      ) : null}
      {error ? (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#b91c1c' }}>{error}</p>
          <button
            onClick={() => void runComparison()}
            disabled={loading}
            style={{
              border: `0.5px solid ${t.border}`,
              background: t.surface,
              color: t.ink,
              borderRadius: 999,
              padding: '2px 8px',
              fontSize: 11,
              fontFamily: fonts.sans,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      ) : null}
      {result ? (
        <div
          style={{
            marginTop: 8,
            border: `0.5px solid ${t.border}`,
            borderRadius: 10,
            background: t.surfaceAlt,
            padding: 10,
            fontSize: 12.5,
            color: t.ink,
            lineHeight: 1.55,
          }}
        >
          Played <b style={{ fontFamily: fonts.mono }}>{playedSAN}</b>: {formatEval(result.playedEval)}<br />
          Book <b style={{ fontFamily: fonts.mono }}>{result.expectedSan}</b>: {formatEval(result.expectedEval)}<br />
          Delta (book - played): <b>{formatEval(result.expectedEval - result.playedEval)}</b>
        </div>
      ) : null}
    </div>
  );
}
