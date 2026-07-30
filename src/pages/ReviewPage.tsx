import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { getLichessRepository } from '../lib/lichess/repository-di';
import { loadPresetFromStorage } from '../engine/presets';
import { selectGhostCandidates } from '../analysis/ghostCandidates';
import { synthesizeGhostLine } from '../analysis/ghostLineSynth';
import { getGhostLineRepository, getSrsRepository } from '../storage';
import { useGameAnalysis } from '../hooks/useGameAnalysis';
import type { GameAnalysis } from '../types/analysis';
import type { GhostLineRecord } from '../types/ghost';
import { WhyNotMovePanel } from '../components/coach/WhyNotMovePanel';

type GameLoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

type ViewState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      gameId: string;
      analysis: GameAnalysis;
      plies: Array<Record<string, unknown>>;
      ghost: ReturnType<typeof selectGhostCandidates>;
    };

export function ReviewPage(): React.JSX.Element {
  const t = useTokens();
  const { gameId } = useParams<{ gameId: string }>();
  const [gameLoadState, setGameLoadState] = useState<GameLoadState>({ kind: 'loading' });
  const [pgn, setPgn] = useState<string | null>(null);
  const [savingGhostKey, setSavingGhostKey] = useState<string | null>(null);
  const [savedGhostKeys, setSavedGhostKeys] = useState<Set<string>>(() => new Set());
  const [savedGhostLineIds, setSavedGhostLineIds] = useState<Map<string, string>>(() => new Map());
  const [savedGhosts, setSavedGhosts] = useState<GhostLineRecord[]>([]);

  async function refreshSavedGhosts(targetGameId: string): Promise<void> {
    const rows = await getGhostLineRepository().listByGame(targetGameId);
    setSavedGhosts(rows.sort((a, b) => b.created_at - a.created_at));
  }
  const preset = loadPresetFromStorage();
  const analysisState = useGameAnalysis({
    gameId: gameId ?? null,
    pgn,
    enginePreset: preset,
    maxPlies: 40,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!gameId) {
        setGameLoadState({ kind: 'missing' });
        setPgn(null);
        return;
      }
      try {
        const game = await getLichessRepository().getGame(gameId);
        if (cancelled) return;
        if (!game) {
          setGameLoadState({ kind: 'missing' });
          setPgn(null);
          return;
        }
        setPgn(game.pgn);
        setGameLoadState({ kind: 'loading' });
      } catch (e) {
        if (cancelled) return;
        setGameLoadState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
        setPgn(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  const state: ViewState = useMemo(() => {
    if (gameLoadState.kind === 'missing' || gameLoadState.kind === 'error') return gameLoadState;
    if (!gameId || !pgn || analysisState.kind === 'idle' || analysisState.kind === 'loading') {
      return { kind: 'loading' };
    }
    if (analysisState.kind === 'error') return { kind: 'error', message: analysisState.message };
    return {
      kind: 'ready',
      gameId,
      analysis: analysisState.analysis,
      plies: analysisState.analysis.plies,
      ghost: selectGhostCandidates(analysisState.analysis),
    };
  }, [analysisState, gameId, gameLoadState, pgn]);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    let cancelled = false;
    void getGhostLineRepository()
      .listByGame(state.gameId)
      .then((rows) => {
        if (!cancelled) setSavedGhosts(rows.sort((a, b) => b.created_at - a.created_at));
      })
      .catch(() => {
        if (!cancelled) setSavedGhosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  async function addGhostToDrills(plyIndex: number): Promise<void> {
    if (state.kind !== 'ready') return;
    const candidate = state.ghost.find((g) => g.plyIndex === plyIndex);
    if (!candidate) return;
    const key = `${candidate.gameId}:${candidate.plyIndex}`;
    setSavingGhostKey(key);
    try {
      const events = await getLichessRepository().getOOBEvents({ gameId: candidate.gameId, limit: 100 });
      const anchor = events
        .filter((e) => e.lineId && e.plyIndex <= candidate.plyIndex)
        .sort((a, b) => b.plyIndex - a.plyIndex)[0];
      const parentLineId = anchor?.lineId ?? null;
      const ghost = synthesizeGhostLine(state.analysis, candidate, { parentLineId });
      const existing = await getGhostLineRepository().get(ghost.id);
      if (!existing) {
        await getGhostLineRepository().put(ghost);
      }
      // Seed SRS entry so it joins normal review cadence.
      await getSrsRepository().recordDrillResult(ghost.id, {
        wrong_attempts: 3,
        hint_uses: 0,
        duration_ms: 0,
        completed_at: new Date().toISOString(),
      });
      setSavedGhostKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setSavedGhostLineIds((prev) => {
        const next = new Map(prev);
        next.set(key, ghost.id);
        return next;
      });
      await refreshSavedGhosts(candidate.gameId);
    } finally {
      setSavingGhostKey(null);
    }
  }

  async function removeGhost(lineId: string): Promise<void> {
    if (state.kind !== 'ready') return;
    await getGhostLineRepository().remove(lineId);
    await getSrsRepository().resetState(lineId);
    await refreshSavedGhosts(state.gameId);
  }

  const avgCpLoss = useMemo(() => {
    if (state.kind !== 'ready' || state.plies.length === 0) return 0;
    const vals = state.plies
      .map((p) => Number(p.cpLoss))
      .filter((x) => Number.isFinite(x) && x > 0);
    if (vals.length === 0) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [state]);

  return (
    <PageBody>
      <PageHeader title="Game Review" subtitle="Cached engine pass + ghost candidates from your synced game." />
      {state.kind === 'loading' ? (
        <p style={{ margin: 0, fontFamily: fonts.sans, color: t.inkSoft }}>Analyzing game…</p>
      ) : null}
      {state.kind === 'missing' ? (
        <p style={{ margin: 0, fontFamily: fonts.sans, color: t.inkSoft }}>
          Game not found. <Link to="/games" style={{ color: t.brand }}>Back to Games</Link>
        </p>
      ) : null}
      {state.kind === 'error' ? (
        <p style={{ margin: 0, fontFamily: fonts.sans, color: '#b91c1c' }}>{state.message}</p>
      ) : null}
      {state.kind === 'ready' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <CardTitle>Review Summary</CardTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              <Stat label="Analyzed plies" value={String(state.plies.length)} />
              <Stat label="Avg cp-loss" value={String(avgCpLoss)} />
              <Stat label="Ghost candidates" value={String(state.ghost.length)} />
            </div>
            <CpLossSparkline plies={state.plies} />
          </Card>
          <Card>
            <CardTitle>Ghost Candidates</CardTitle>
            {state.ghost.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12.5, color: t.inkSoft, fontFamily: fonts.sans }}>
                No ghost candidates detected at current threshold.
              </p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {state.ghost.map((g) => (
                  <li key={`${g.gameId}-${g.plyIndex}`} style={{ fontFamily: fonts.sans, fontSize: 12.5, color: t.ink }}>
                    ply {g.plyIndex + 1}: played <b style={{ fontFamily: fonts.mono }}>{g.playedSan}</b> vs{' '}
                    <b style={{ fontFamily: fonts.mono }}>{g.bestSan}</b> ({g.cpLoss} cp)
                    <button
                      onClick={() => void addGhostToDrills(g.plyIndex)}
                      disabled={savingGhostKey === `${g.gameId}:${g.plyIndex}` || savedGhostKeys.has(`${g.gameId}:${g.plyIndex}`)}
                      style={{
                        marginLeft: 8,
                        border: `0.5px solid ${t.border}`,
                        background: t.surface,
                        color: t.ink,
                        borderRadius: 999,
                        padding: '3px 8px',
                        fontSize: 11,
                        fontFamily: fonts.sans,
                        cursor: 'pointer',
                      }}
                    >
                      {savedGhostKeys.has(`${g.gameId}:${g.plyIndex}`)
                        ? 'Added'
                        : savingGhostKey === `${g.gameId}:${g.plyIndex}`
                          ? 'Adding…'
                          : 'Add to drills'}
                    </button>
                    {savedGhostKeys.has(`${g.gameId}:${g.plyIndex}`) &&
                    savedGhostLineIds.has(`${g.gameId}:${g.plyIndex}`) ? (
                      <Link
                        to={`/drill?line=${encodeURIComponent(
                          savedGhostLineIds.get(`${g.gameId}:${g.plyIndex}`)!,
                        )}`}
                        style={{ color: t.brand, marginLeft: 6 }}
                      >
                        open
                      </Link>
                    ) : null}
                    {(() => {
                      const ply = state.plies.find((p) => Number(p.plyIndex) === g.plyIndex);
                      const fenAtOOB = String(ply?.fenBefore ?? '');
                      if (!fenAtOOB) return null;
                      return (
                        <WhyNotMovePanel
                          fenAtOOB={fenAtOOB}
                          playedSAN={g.playedSan}
                          expectedSANs={[g.bestSan]}
                        />
                      );
                    })()}
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card>
            <CardTitle>Injected Ghost Drills</CardTitle>
            {savedGhosts.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12.5, color: t.inkSoft, fontFamily: fonts.sans }}>
                No injected ghost drills yet for this game.
              </p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {savedGhosts.map((g) => (
                  <li key={g.id} style={{ fontFamily: fonts.sans, fontSize: 12.5, color: t.ink }}>
                    ply {g.origin_ply + 1} • fix <b style={{ fontFamily: fonts.mono }}>{g.moves[g.moves.length - 1] ?? '(unknown)'}</b>
                    <Link to={`/drill?line=${encodeURIComponent(g.id)}`} style={{ color: t.brand, marginLeft: 6 }}>
                      drill
                    </Link>
                    <button
                      onClick={() => void removeGhost(g.id)}
                      style={{
                        marginLeft: 8,
                        border: `0.5px solid ${t.border}`,
                        background: t.surface,
                        color: t.ink,
                        borderRadius: 999,
                        padding: '3px 8px',
                        fontSize: 11,
                        fontFamily: fonts.sans,
                        cursor: 'pointer',
                      }}
                    >
                      dismiss
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      ) : null}
    </PageBody>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  const t = useTokens();
  return (
    <div style={{ background: t.surfaceAlt, borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 10.5, color: t.inkSoft, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: fonts.sans }}>
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: t.ink, fontFamily: fonts.sans }}>{value}</div>
    </div>
  );
}

function CpLossSparkline({ plies }: { plies: Array<Record<string, unknown>> }): React.JSX.Element {
  const t = useTokens();
  const points = plies
    .map((p, i) => ({ x: i, y: Math.max(0, Number(p.cpLoss) || 0) }))
    .filter((p) => Number.isFinite(p.y));
  if (points.length < 2) return <p style={{ margin: '10px 0 0', color: t.inkSoft, fontSize: 12 }}>Not enough data for trend.</p>;
  const w = 360;
  const h = 90;
  const maxY = Math.max(...points.map((p) => p.y), 1);
  const path = points
    .map((p, i) => {
      const px = (p.x / (points.length - 1)) * (w - 8) + 4;
      const py = h - 4 - (p.y / maxY) * (h - 12);
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(' ');
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: t.inkSoft, marginBottom: 4, fontFamily: fonts.sans }}>cp-loss trend</div>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Centipawn loss trend">
        <rect x="0" y="0" width={w} height={h} rx="8" fill={t.surfaceAlt} />
        <path d={path} fill="none" stroke={t.brand} strokeWidth="2" />
      </svg>
    </div>
  );
}
