/**
 * /lichess/oob/:gameId/:plyIndex — OOB position viewer (Phase 3 R7).
 *
 * Read-only board at `fenAtOOB`: played move tinted red, expected moves
 * tinted green via ChessBoardPanel's squareStyles (the shared highlight
 * surface, Article 15). Metadata panel + CoachSlot placeholder + external
 * link to the game on Lichess.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { ChessBoardPanel } from '../ui/ChessBoardPanel';
import { CoachSlot } from '../components/coach/CoachSlot';
import { getLichessRepository } from '../lib/lichess/repository-di';
import { getRepository } from '../storage';
import { LICHESS } from '../lib/lichess/types';
import type { LichessGame, OOBEvent } from '../lib/lichess/types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ready'; event: OOBEvent; game: LichessGame | null; lineName: string | null };

/** from/to squares of a SAN move played from `fen`; null if illegal. */
function squaresOf(fen: string, san: string): { from: string; to: string } | null {
  try {
    const board = new Chess(fen);
    const move = board.move(san);
    return { from: move.from, to: move.to };
  } catch {
    return null;
  }
}

export function OOBPositionViewerPage() {
  const t = useTokens();
  const { gameId, plyIndex } = useParams<{ gameId: string; plyIndex: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    void (async () => {
      const repo = getLichessRepository();
      const events = await repo.getOOBEvents({ gameId: gameId ?? '' });
      const event = events.find((e) => e.plyIndex === Number(plyIndex)) ?? null;
      if (!event) {
        setState({ kind: 'missing' });
        return;
      }
      const game = await repo.getGame(event.gameId);
      // Line removed in a catalog refresh renders "(line removed)" (R5 AC8).
      let lineName: string | null = null;
      if (event.lineId) {
        const line = await getRepository().getLine(event.lineId);
        lineName = line?.name ?? '(line removed)';
      }
      setState({ kind: 'ready', event, game, lineName });
    })();
  }, [gameId, plyIndex]);

  if (state.kind === 'loading') {
    return (
      <PageBody>
        <PageHeader title="Out-of-book moment" />
        <p style={{ fontFamily: fonts.sans, color: t.inkSoft }}>Loading…</p>
      </PageBody>
    );
  }
  if (state.kind === 'missing') {
    return (
      <PageBody>
        <PageHeader title="Out-of-book moment" />
        <p style={{ fontFamily: fonts.sans, color: t.inkSoft }}>
          Event not found. <Link to="/" style={{ color: t.brand }}>Back to Dashboard</Link>
        </p>
      </PageBody>
    );
  }

  const { event, game, lineName } = state;
  const played = squaresOf(event.fenAtOOB, event.playedSAN);
  const expected = event.expectedSANs
    .map((san) => ({ san, sq: squaresOf(event.fenAtOOB, san) }))
    .filter((x): x is { san: string; sq: { from: string; to: string } } => x.sq !== null);

  // Article 15 — highlights ride the shared squareStyles surface.
  const squareStyles: Record<string, React.CSSProperties> = {};
  for (const { sq } of expected) {
    squareStyles[sq.to] = { background: 'rgba(40,170,60,0.38)' };
  }
  if (played) {
    squareStyles[played.from] = { background: 'rgba(220,55,55,0.28)' };
    squareStyles[played.to] = { background: 'rgba(220,55,55,0.45)' };
  }

  return (
    <PageBody>
      <PageHeader title="Out-of-book moment" />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 480px) 1fr', gap: 16 }}>
        <div>
          <ChessBoardPanel
            fen={event.fenAtOOB}
            flashOverlay={null}
            boardOrientation={event.color}
            squareStyles={squareStyles}
            onPieceDrop={() => false}
          />
        </div>
        <Card>
          <div style={{ fontFamily: fonts.sans, color: t.ink, fontSize: 13.5, lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {event.openingName ?? 'Unknown opening'}
              {event.openingEco ? (
                <span style={{ color: t.inkSoft, fontFamily: fonts.mono, fontSize: 12, marginLeft: 8 }}>
                  {event.openingEco}
                </span>
              ) : null}
            </div>
            {game ? (
              <div style={{ color: t.inkSoft, fontSize: 12.5, marginBottom: 10 }}>
                vs {game.userColor === 'white' ? game.blackUsername : game.whiteUsername} ·{' '}
                {new Date(game.createdAt).toLocaleDateString()} · {game.result}
              </div>
            ) : null}
            <div>
              You played:{' '}
              <b style={{ fontFamily: fonts.mono, color: t.red }}>{event.playedSAN}</b>
            </div>
            <div>
              Expected:{' '}
              <b style={{ fontFamily: fonts.mono, color: t.success }}>
                {event.expectedSANs.join(', ')}
              </b>
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5 }}>
              Line:{' '}
              {event.lineId && lineName !== '(line removed)' ? (
                <Link to="/repertoire" style={{ color: t.brand }}>
                  {lineName}
                </Link>
              ) : (
                <span style={{ color: t.inkSoft }}>{lineName ?? '—'}</span>
              )}
            </div>

            <CoachSlot
              gameId={event.gameId}
              plyIndex={event.plyIndex}
              fenAtOOB={event.fenAtOOB}
              playedSAN={event.playedSAN}
              expectedSANs={event.expectedSANs}
              lineId={event.lineId}
            />

            <div style={{ marginTop: 14 }}>
              <a
                href={LICHESS.gameWebUrl(event.gameId, event.color)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: t.brand, fontSize: 12.5 }}
              >
                View full game on Lichess ↗
              </a>
            </div>
          </div>
        </Card>
      </div>
    </PageBody>
  );
}
