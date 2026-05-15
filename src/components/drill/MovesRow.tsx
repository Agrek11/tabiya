/**
 * MovesRow — flat wrapping chips for the played moves of a drill, with an
 * overflow (⋮) dropdown for Restart / Skip / Hint.
 *
 * Behavior:
 *   - Played chips render with surface bg + border.
 *   - Active chip (most recent played move) renders with brand fill + brandInk
 *     text — matches v1 preview `.move-chip.active`.
 *   - Fork badge (⋔, amber pill) renders INSIDE the chip whose ply has a
 *     ForkAnnotation. Clicking it toggles a popover next to the chip.
 *   - Upcoming chips are NOT rendered. The drill rail / Why This Move handles
 *     guidance.
 *
 * The component owns the open-fork popover state because it's purely visual.
 */

import { useState, type ReactNode } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { useClickOutside } from '../../ui/use-click-outside';
import type { ForkAnnotation } from '../../storage/types';

type MovesRowProps = {
  moves: readonly string[];
  playedCount: number;
  /** Optional next-expected ply index — outlined with a brand underline if
   *  greater than playedCount. Useful for visual continuity when the drill is
   *  awaiting the player's move. */
  nextIdx?: number;
  forks?: readonly ForkAnnotation[];
  overflowItems?: OverflowItem[];
  /** When provided, clicking a played chip jumps the board to that ply.
   *  `ply` is the chip's zero-based ply index (i.e. clicking the 1st move
   *  fires onJumpToPly(0)). The drill page interprets that as "show position
   *  AFTER ply N played" by calling jumpToPly(N + 1) on useDrill. */
  onJumpToPly?: (ply: number) => void;
};

export type OverflowItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  testid?: string;
};

export function MovesRow({
  moves,
  playedCount,
  nextIdx,
  forks,
  overflowItems = [],
  onJumpToPly,
}: MovesRowProps) {
  const t = useTokens();
  const [openOverflow, setOpenOverflow] = useState(false);
  const forksByPly = new Map<number, ForkAnnotation>();
  if (forks) for (const f of forks) forksByPly.set(f.ply_index, f);

  const visibleEnd = Math.min(moves.length, playedCount);
  // Render in classic notation pairs. Ply 0 = white move of move 1; ply 1 =
  // black move of move 1; etc. Each row = [move_no, white_chip, black_chip].
  // The "next-expected" ply renders as a ghost chip in its slot when not yet
  // played.
  const totalToShow = Math.max(
    visibleEnd,
    nextIdx !== undefined && nextIdx >= visibleEnd && nextIdx < moves.length ? nextIdx + 1 : 0
  );
  const moveCount = Math.ceil(totalToShow / 2);

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr 1fr',
          rowGap: 4,
          columnGap: 6,
          alignItems: 'center',
        }}
      >
        {Array.from({ length: moveCount }).map((_, moveIdx) => {
          const whitePly = moveIdx * 2;
          const blackPly = moveIdx * 2 + 1;
          return (
            <div key={moveIdx} style={{ display: 'contents' }}>
              <div
                style={{
                  fontSize: 11.5,
                  fontFamily: fonts.mono,
                  color: t.inkSoft,
                  fontWeight: 600,
                  textAlign: 'right',
                  paddingRight: 2,
                }}
              >
                {moveIdx + 1}.
              </div>
              <PlySlot
                ply={whitePly}
                move={moves[whitePly]}
                visibleEnd={visibleEnd}
                nextIdx={nextIdx}
                fork={forksByPly.get(whitePly) ?? null}
                tokens={t}
                onJump={onJumpToPly}
              />
              <PlySlot
                ply={blackPly}
                move={moves[blackPly]}
                visibleEnd={visibleEnd}
                nextIdx={nextIdx}
                fork={forksByPly.get(blackPly) ?? null}
                tokens={t}
                onJump={onJumpToPly}
              />
            </div>
          );
        })}
      </div>
      {overflowItems.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <OverflowMenu
            open={openOverflow}
            onOpenChange={setOpenOverflow}
            items={overflowItems}
          />
        </div>
      )}
    </div>
  );
}

function PlySlot({
  ply,
  move,
  visibleEnd,
  nextIdx,
  fork,
  tokens,
  onJump,
}: {
  ply: number;
  move: string | undefined;
  visibleEnd: number;
  nextIdx: number | undefined;
  fork: ForkAnnotation | null;
  tokens: ReturnType<typeof useTokens>;
  onJump?: (ply: number) => void;
}) {
  if (move === undefined) return <span />;
  const played = ply < visibleEnd;
  const isActive = played && ply === visibleEnd - 1;
  const isNext = nextIdx !== undefined && ply === nextIdx;
  const ghostNext = !played && isNext;
  if (!played && !ghostNext) return <span />;
  return (
    <MoveChip
      move={move}
      ply={ply}
      active={isActive}
      fork={fork}
      isNext={isNext}
      ghostNext={ghostNext}
      tokens={tokens}
      onJump={onJump}
    />
  );
}

function MoveChip({
  move,
  active,
  ply,
  fork,
  isNext,
  ghostNext = false,
  tokens,
  onJump,
}: {
  move: string;
  ply: number;
  active: boolean;
  fork: ForkAnnotation | null;
  isNext: boolean;
  ghostNext?: boolean;
  tokens: ReturnType<typeof useTokens>;
  onJump?: (ply: number) => void;
}) {
  const t = tokens;
  const [popoverOpen, setPopoverOpen] = useState(false);
  // Played chips are clickable for jump; ghost-next is not (no position to jump to).
  const jumpable = onJump !== undefined && !ghostNext;
  return (
    <span
      data-testid={`move-cell-${ply}`}
      onClick={jumpable ? () => onJump(ply) : undefined}
      role={jumpable ? 'button' : undefined}
      tabIndex={jumpable ? 0 : undefined}
      onKeyDown={
        jumpable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onJump(ply);
              }
            }
          : undefined
      }
      title={jumpable ? `Jump to position after ${move}` : undefined}
      style={{
        position: 'relative',
        padding: '7px 12px',
        borderRadius: 10,
        background: active ? t.brand : ghostNext ? t.surfaceAlt : t.surface,
        border: active ? 'none' : `0.5px solid ${isNext ? t.brand : t.border}`,
        color: active ? t.brandInk : ghostNext ? t.inkSoft : t.ink,
        fontSize: 12.5,
        fontFamily: fonts.mono,
        fontWeight: active ? 600 : 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: jumpable ? 'pointer' : 'default',
      }}
    >
      <span>{move}</span>
      {fork && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPopoverOpen((v) => !v);
          }}
          data-testid={`fork-badge-${ply}`}
          aria-label={`Fork at ply ${ply}`}
          title={fork.label}
          style={{
            background: t.amber,
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ⋔
        </button>
      )}
      {fork && popoverOpen && (
        <ForkPopover fork={fork} onClose={() => setPopoverOpen(false)} />
      )}
    </span>
  );
}

function ForkPopover({
  fork,
  onClose,
}: {
  fork: ForkAnnotation;
  onClose: () => void;
}) {
  const t = useTokens();
  const ref = useClickOutside<HTMLDivElement>(true, onClose);
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 6,
        background: t.surface,
        border: `0.5px solid ${t.border}`,
        borderRadius: 10,
        boxShadow: t.shadowMd,
        padding: 12,
        width: 280,
        zIndex: 50,
        fontFamily: fonts.sans,
        fontSize: 12.5,
        color: t.ink,
        textAlign: 'left',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, color: t.brand, marginBottom: 6 }}>
        {fork.label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {fork.alternatives.map((alt) => (
          <span
            key={alt}
            style={{
              padding: '2px 8px',
              background: t.surfaceAlt,
              borderRadius: 999,
              fontSize: 12,
              fontFamily: fonts.mono,
              color: t.ink,
            }}
          >
            {alt}
          </span>
        ))}
      </div>
      {fork.rationale && (
        <div style={{ fontSize: 12, color: t.inkDim, lineHeight: 1.45 }}>{fork.rationale}</div>
      )}
    </div>
  );
}

function OverflowMenu({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: OverflowItem[];
}) {
  const t = useTokens();
  const ref = useClickOutside<HTMLDivElement>(open, () => onOpenChange(false));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => onOpenChange(!open)}
        aria-label="Drill actions"
        aria-expanded={open}
        style={{
          width: 34,
          height: 32,
          padding: 0,
          borderRadius: 10,
          background: t.surface,
          border: `0.5px solid ${t.border}`,
          color: t.inkDim,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DotsIcon />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: t.surface,
            border: `0.5px solid ${t.border}`,
            borderRadius: 10,
            boxShadow: t.shadowMd,
            padding: 6,
            zIndex: 40,
            minWidth: 160,
          }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                if (!it.disabled) {
                  it.onClick();
                  onOpenChange(false);
                }
              }}
              disabled={it.disabled}
              data-testid={it.testid}
              className="tabiya-popover-item"
              style={{
                width: '100%',
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                cursor: it.disabled ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                fontSize: 13,
                fontFamily: fonts.sans,
                color: it.disabled ? t.inkSoft : t.ink,
                opacity: it.disabled ? 0.5 : 1,
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}
