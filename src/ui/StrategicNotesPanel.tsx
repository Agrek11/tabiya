/**
 * StrategicNotesPanel — collapsible bullet list of `Line.strategic_notes`.
 *
 * Persisted open/closed in `localStorage tabiya.strategyOpen`. Empty notes
 * render an empty-state caption rather than hiding the panel entirely, so
 * users learn the panel exists.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';
import { useTokens } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';

const KEY = 'tabiya.strategyOpen';

function readOpen(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

function writeOpen(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    /* quota / private */
  }
}

export function StrategicNotesPanel({ notes }: { notes: readonly string[] }) {
  const t = useTokens();
  const [open, setOpenState] = useState<boolean>(() => readOpen());

  useEffect(() => {
    writeOpen(open);
  }, [open]);

  return (
    <div
      data-testid="strategy-panel"
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: radius.card,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpenState((v) => !v)}
        aria-expanded={open}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: fonts.sans,
          fontSize: 13,
          fontWeight: 600,
          color: t.ink,
        }}
      >
        {open ? <ChevronDown size={14} color={t.inkDim} /> : <ChevronRight size={14} color={t.inkDim} />}
        <Lightbulb size={14} color={t.brand} />
        <span style={{ flex: 1 }}>Strategy</span>
        <span style={{ fontSize: 11, color: t.inkSoft, fontWeight: 500 }}>
          {notes.length === 0 ? '—' : `${notes.length} note${notes.length === 1 ? '' : 's'}`}
        </span>
      </button>
      {open && (
        <div
          style={{
            borderTop: `1px solid ${t.border}`,
            padding: '12px 14px',
            fontFamily: fonts.sans,
            fontSize: 13,
            color: t.ink,
            lineHeight: 1.5,
          }}
        >
          {notes.length === 0 ? (
            <span style={{ color: t.inkSoft, fontStyle: 'italic' }}>
              No notes for this line yet.
            </span>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {notes.map((note, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
