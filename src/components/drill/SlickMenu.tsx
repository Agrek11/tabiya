/**
 * SlickMenu — search-prefixed picker dropdown used by DrillPage opening/line
 * menus. Carried forward from the prior DrillPage implementation, factored out
 * so the page stays focused on layout and behavior.
 *
 * Visual: surface popover, 14px radius, shadow-md. Header items are uppercase
 * eyebrows; item radio circles fill with `t.brand` when selected. Hover
 * affordance comes from the global `.tabiya-popover-item` CSS rule.
 */

import { Search, X } from 'lucide-react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

export type SlickMenuItem =
  | { kind: 'item'; key: string; label: string; isCurrent: boolean; onPick: () => void }
  | { kind: 'header'; key: string; label: string };

export function SlickMenu({
  placeholder,
  searchValue,
  onSearch,
  items,
  emptyHint,
  width = 320,
}: {
  placeholder: string;
  searchValue: string;
  onSearch: (v: string) => void;
  items: ReadonlyArray<SlickMenuItem>;
  emptyHint: string;
  width?: number;
}) {
  const t = useTokens();
  return (
    <div
      role="menu"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        width,
        maxHeight: 480,
        overflowY: 'auto',
        background: t.surface,
        border: `0.5px solid ${t.border}`,
        borderRadius: 14,
        boxShadow: t.shadowMd,
        padding: 6,
        zIndex: 60,
      }}
    >
      <div style={{ padding: 6, marginBottom: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: t.surfaceAlt,
            borderRadius: 10,
            padding: '7px 11px',
          }}
        >
          <Search size={13} color={t.inkDim} />
          <input
            autoFocus
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              flex: 1,
              fontFamily: fonts.sans,
              fontSize: 13,
              color: t.ink,
              minWidth: 0,
            }}
          />
          {searchValue && (
            <button
              onClick={() => onSearch('')}
              aria-label="Clear search"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                color: t.inkSoft,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div
          style={{
            padding: '20px 12px',
            textAlign: 'center',
            fontSize: 13,
            color: t.inkDim,
            fontFamily: fonts.sans,
          }}
        >
          {emptyHint}
        </div>
      ) : (
        items.map((it) =>
          it.kind === 'header' ? (
            <div
              key={it.key}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: t.inkSoft,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                padding: '10px 12px 4px',
                fontFamily: fonts.sans,
              }}
            >
              {it.label}
            </div>
          ) : (
            <button
              key={it.key}
              onClick={it.onPick}
              className="tabiya-popover-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px 10px 18px',
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: fonts.sans,
                color: it.isCurrent ? t.brand : t.ink,
                fontWeight: it.isCurrent ? 700 : 500,
                fontSize: 14.5,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: `2px solid ${it.isCurrent ? t.brand : t.border}`,
                  background: it.isCurrent ? t.brand : 'transparent',
                  flexShrink: 0,
                  boxShadow: it.isCurrent ? `inset 0 0 0 2px ${t.surface}` : 'none',
                }}
              />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {it.label}
              </span>
            </button>
          )
        )
      )}
    </div>
  );
}
