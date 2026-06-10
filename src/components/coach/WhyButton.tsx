/**
 * WhyButton — opens the Coach modal for the current drill position (Task 8.1).
 *
 * Rendered during an active drill. Click or press `?` (Shift+/) to open; the
 * shortcut is ignored while an input/textarea is focused and cleaned up on
 * unmount (R7.1, R7.7).
 */

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { CoachModal } from './CoachModal';
import { sansToHistory } from '../../coach/CoachContextBuilder';

export type WhyButtonProps = {
  lineName: string;
  lineId?: string;
  fen: string;
  /** Number of plies played so far (= index into the line's SAN list). */
  plyIndex: number;
  /** The line's SAN moves, used to build recent-ply history for the prompt. */
  lineSans: readonly string[];
};

export function WhyButton(props: WhyButtonProps) {
  const t = useTokens();
  const [open, setOpen] = useState(false);
  const { lineName, lineId, fen, plyIndex, lineSans } = props;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== '?') return;
      const el = document.activeElement;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement | null)?.isContentEditable) {
        return;
      }
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Why is this the best move?"
        title="Why? (press ?)"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: t.surfaceAlt,
          border: `0.5px solid ${t.border}`,
          borderRadius: 999,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 500,
          fontFamily: fonts.sans,
          color: t.ink,
          cursor: 'pointer',
        }}
      >
        <Sparkles size={12} />
        Why?
      </button>
      {open ? (
        <CoachModal
          lineName={lineName}
          lineId={lineId}
          plyIndex={plyIndex}
          fen={fen}
          history={sansToHistory(lineSans.slice(0, plyIndex))}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
