import { useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { ChessBoardPanel } from '../ui/ChessBoardPanel';
import { CoachPipeline, formatEval } from '../coach/CoachPipeline';
import type { CoachResult } from '../coach/CoachPipeline';

const START_FEN = 'rn1qkbnr/pppb1ppp/4p3/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 2 4';

export function CoachPage() {
  const t = useTokens();
  const [sp] = useSearchParams();
  const initialFen = sp.get('fen') ?? START_FEN;
  const [fen, setFen] = useState(initialFen);
  const [result, setResult] = useState<CoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>((sp.get('color') as 'white' | 'black') ?? 'white');

  const validFen = useMemo(() => {
    try {
      const b = new Chess(fen);
      return b.fen();
    } catch {
      return null;
    }
  }, [fen]);

  async function runCoach(): Promise<void> {
    if (!validFen) return;
    setLoading(true);
    setError(null);
    try {
      const r = await CoachPipeline.run({
        fen: validFen,
        history: [],
        lineId: 'coach-any-position',
        plyIndex: 0,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageBody>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 620px) minmax(300px, 1fr)', gap: 16 }}>
        <Card>
          <CardTitle>Coach Board</CardTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <textarea
              value={fen}
              onChange={(e) => setFen(e.target.value)}
              spellCheck={false}
              rows={3}
              style={{
                width: '100%',
                border: `0.5px solid ${t.border}`,
                borderRadius: 10,
                background: t.surface,
                color: t.ink,
                fontFamily: fonts.mono,
                fontSize: 12,
                padding: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} style={btn(t)}>
                Flip: {orientation}
              </button>
              <button onClick={() => void runCoach()} disabled={!validFen || loading} style={btn(t)}>
                {loading ? 'Analyzing…' : 'Analyze Position'}
              </button>
              {!validFen ? <span style={{ fontSize: 12, color: '#b45309' }}>Invalid FEN</span> : null}
            </div>
            <ChessBoardPanel
              fen={validFen ?? START_FEN}
              boardOrientation={orientation}
              squareStyles={{}}
              flashOverlay={null}
              onPieceDrop={() => false}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Coach Output</CardTitle>
          {error ? (
            <p style={{ margin: 0, color: '#b91c1c', fontSize: 13 }}>{error}</p>
          ) : result === null ? (
            <p style={{ margin: 0, color: t.inkDim, fontSize: 13 }}>
              Paste any legal FEN and click Analyze Position.
            </p>
          ) : result.engine === null ? (
            <p style={{ margin: 0, color: t.inkDim, fontSize: 13 }}>Engine unavailable.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12, color: t.inkSoft }}>
                Prompt: <strong>{result.promptVersion}</strong>
              </div>
              <div style={{ fontSize: 13, color: t.ink }}>
                Best: {result.engine.bestmove}{' '}
                <span style={{ color: t.brand }}>
                  ({formatEval(result.engine.pvs[0]?.scoreCp ?? 0, result.engine.pvs[0]?.mateIn)})
                </span>
              </div>
              <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {result.engine.pvs.map((pv, i) => (
                  <li key={i} style={{ fontFamily: fonts.mono, fontSize: 12, color: t.inkDim }}>
                    PV {i + 1}: {pv.moves.slice(0, 8).join(' ')} ({formatEval(pv.scoreCp, pv.mateIn)} d{pv.depth})
                  </li>
                ))}
              </ol>
              {result.llm ? (
                <div
                  style={{
                    background: t.surfaceAlt,
                    border: `0.5px solid ${t.border}`,
                    borderRadius: 10,
                    padding: 10,
                    color: t.ink,
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  {result.llm.text}
                </div>
              ) : (
                <p style={{ margin: 0, color: t.inkDim, fontSize: 13 }}>
                  Narration unavailable. Configure AI in Settings to enable LLM prose.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </PageBody>
  );
}

function btn(t: ReturnType<typeof useTokens>): CSSProperties {
  return {
    border: `0.5px solid ${t.border}`,
    background: t.surface,
    color: t.ink,
    borderRadius: 999,
    padding: '7px 12px',
    fontFamily: fonts.sans,
    fontSize: 12,
    cursor: 'pointer',
  };
}
