/**
 * PlayPage — play a position out vs the engine at a chosen strength (Phase 5,
 * 5b). Entered from the end-of-line summary ("Play this out vs the engine") with
 * a start FEN + the player's color, or standalone.
 *
 * Pure engine play (no runtime extractor / analysis needed): the user drags
 * moves, Stockfish replies at the selected Elo tier via `engine.play()`. The
 * worker resets to full strength for any Coach analysis afterward.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { ChessBoardPanel } from '../ui/ChessBoardPanel';
import { loadStockfishEngine } from '../engine/engineLoader';
import { playMove as playMoveSound } from '../sound/sounds';
import type { ChessEngine } from '../engine/ChessEngine';

type Tier = { label: string; elo: number; note: string };
const TIERS: Tier[] = [
  { label: 'Beginner', elo: 800, note: '~800' },
  { label: 'Casual', elo: 1200, note: '~1200' },
  { label: 'Club', elo: 1700, note: '1700' },
  { label: 'Strong', elo: 2000, note: '2000' },
  { label: 'Expert', elo: 2200, note: '2200' },
  { label: 'Master+', elo: 2500, note: '2500+' },
];

type Status =
  | { kind: 'playing' }
  | { kind: 'checkmate'; winner: 'you' | 'engine' }
  | { kind: 'draw'; reason: string }
  | { kind: 'resigned' };

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function deriveStatus(game: Chess, playerColor: 'white' | 'black'): Status {
  if (game.isCheckmate()) {
    // Side to move is checkmated → the OTHER side won.
    const loserIsPlayer = game.turn() === (playerColor === 'white' ? 'w' : 'b');
    return { kind: 'checkmate', winner: loserIsPlayer ? 'engine' : 'you' };
  }
  if (game.isStalemate()) return { kind: 'draw', reason: 'stalemate' };
  if (game.isInsufficientMaterial()) return { kind: 'draw', reason: 'insufficient material' };
  if (game.isThreefoldRepetition()) return { kind: 'draw', reason: 'threefold repetition' };
  if (game.isDraw()) return { kind: 'draw', reason: 'fifty-move rule' };
  return { kind: 'playing' };
}

export function PlayPage() {
  const t = useTokens();
  const [params] = useSearchParams();
  const startFen = params.get('fen') ?? START_FEN;
  const playerColor: 'white' | 'black' = params.get('color') === 'black' ? 'black' : 'white';
  const label = params.get('label');
  const playerCode = playerColor === 'white' ? 'w' : 'b';

  const gameRef = useRef<Chess>(new Chess(startFen));
  // Board renders from `fen` state (the start FEN is already a normalized full
  // FEN from the caller); the ref holds the live game and updates it on moves.
  const [fen, setFen] = useState(startFen);
  const [tierIdx, setTierIdx] = useState(2); // Club (1700) default
  const tier = TIERS[tierIdx]!;
  const [status, setStatus] = useState<Status>({ kind: 'playing' });
  const [thinking, setThinking] = useState(false);
  const [engine, setEngine] = useState<ChessEngine | null>(null);
  const [engineError, setEngineError] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const busyRef = useRef(false);

  // Load the engine once.
  useEffect(() => {
    let cancelled = false;
    void loadStockfishEngine().then(
      (e) => !cancelled && setEngine(e),
      () => !cancelled && setEngineError(true),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const newGame = useCallback(() => {
    gameRef.current = new Chess(startFen);
    setFen(gameRef.current.fen());
    setLastMove(null);
    setStatus({ kind: 'playing' });
    busyRef.current = false;
  }, [startFen]);

  // Engine replies whenever it is its turn and the game is live.
  useEffect(() => {
    if (!engine || status.kind !== 'playing') return;
    const g = gameRef.current;
    const engineTurn = g.turn() !== playerCode;
    if (!engineTurn || busyRef.current) return;

    busyRef.current = true;
    setThinking(true);
    let cancelled = false;
    void engine
      .play(g.fen(), { elo: tier.elo, movetimeMs: 500 })
      .then(({ bestmove }) => {
        if (cancelled || !bestmove) return;
        try {
          const mv = g.move(bestmove);
          playMoveSound();
          setLastMove({ from: mv.from, to: mv.to });
          setFen(g.fen());
          setStatus(deriveStatus(g, playerColor));
        } catch {
          /* engine returned an unexpected move — ignore */
        }
      })
      .finally(() => {
        if (cancelled) return;
        busyRef.current = false;
        setThinking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engine, status, fen, tier.elo, playerCode, playerColor]);

  const onPieceDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string;
  }): boolean => {
    if (status.kind !== 'playing' || thinking) return false;
    const g = gameRef.current;
    if (g.turn() !== playerCode) return false;
    try {
      const mv = g.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      playMoveSound();
      setLastMove({ from: mv.from, to: mv.to });
      setFen(g.fen());
      setStatus(deriveStatus(g, playerColor));
      return true;
    } catch {
      return false; // illegal
    }
  };

  const squareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    const tint = { backgroundColor: 'rgba(155, 199, 0, 0.42)' };
    squareStyles[lastMove.from] = tint;
    squareStyles[lastMove.to] = tint;
  }

  const statusText = ((): string => {
    switch (status.kind) {
      case 'playing':
        return thinking
          ? 'Engine thinking…'
          : fen.split(' ')[1] === playerCode
            ? 'Your move'
            : 'Engine to move';
      case 'checkmate':
        return status.winner === 'you' ? 'Checkmate — you win! 🎉' : 'Checkmate — engine wins.';
      case 'draw':
        return `Draw — ${status.reason}.`;
      case 'resigned':
        return 'You resigned.';
    }
  })();

  return (
    <PageBody>
      <PageHeader
        title="Play vs Engine"
        subtitle={
          label
            ? `Playing out: ${label}`
            : 'Play the position out against Stockfish at your chosen strength.'
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 320px', gap: 16, alignItems: 'start', justifyContent: 'center' }}>
        <div
          style={{
            position: 'relative',
            width: 'min(820px, calc(100vh - 230px))',
            height: 'min(820px, calc(100vh - 230px))',
            borderRadius: 16,
            overflow: 'hidden',
            border: `0.5px solid ${t.border}`,
            background: t.surface,
          }}
        >
          <ChessBoardPanel
            fen={fen}
            flashOverlay={null}
            boardOrientation={playerColor}
            squareStyles={squareStyles}
            onPieceDrop={onPieceDrop}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <Card>
            <CardTitle>Status</CardTitle>
            <div style={{ fontFamily: fonts.sans, fontSize: 15, fontWeight: 600, color: t.ink }}>
              {engineError ? 'Engine unavailable — reload to retry.' : statusText}
            </div>
            {!engine && !engineError ? (
              <div style={{ fontSize: 12.5, color: t.inkSoft, marginTop: 6, fontFamily: fonts.sans }}>
                Loading engine…
              </div>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Strength</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TIERS.map((tr, i) => {
                const active = i === tierIdx;
                return (
                  <button
                    key={tr.label}
                    onClick={() => setTierIdx(i)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: `0.5px solid ${active ? t.brand : t.border}`,
                      background: active ? t.brandSoft : t.surfaceAlt,
                      color: active ? t.brand : t.ink,
                      fontFamily: fonts.sans,
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{tr.label}</span>
                    <span style={{ color: t.inkSoft, fontFamily: fonts.mono, fontSize: 12 }}>{tr.note}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 8, fontFamily: fonts.sans, lineHeight: 1.5 }}>
              New strength applies on the engine's next move. Beginner/Casual approximate weak play (Skill Level); higher tiers cap real Elo.
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={newGame} style={primaryBtn(t)}>New game</button>
              {status.kind === 'playing' ? (
                <button onClick={() => setStatus({ kind: 'resigned' })} style={ghostBtn(t)}>
                  Resign
                </button>
              ) : null}
              <Link to="/drill" style={{ ...ghostBtn(t), textDecoration: 'none' }}>
                Back to drill
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </PageBody>
  );
}

function primaryBtn(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    background: t.brand,
    color: t.brandInk,
    border: 'none',
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    fontFamily: fonts.sans,
    cursor: 'pointer',
  };
}

function ghostBtn(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    background: t.surfaceAlt,
    color: t.ink,
    border: `0.5px solid ${t.border}`,
    padding: '8px 14px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: fonts.sans,
    cursor: 'pointer',
  };
}
