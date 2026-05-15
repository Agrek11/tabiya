/**
 * TruncatedText — Phase 1b R7 primitive.
 *
 * Renders a string. If `text.length > limit`, shows the first `limit`
 * characters followed by an ellipsis and a "show more" toggle. Expanded
 * state is local-only. To reset on ply change, the consumer remounts the
 * component via a `key` prop on the parent (no effect needed).
 *
 * Article 14 — strict TS, no `any`.
 */

import { useState, type CSSProperties } from 'react';

export type TruncatedTextProps = {
  text: string;
  /** Character limit before truncation kicks in. Default 280 (R7). */
  limit?: number;
  /** Optional class/inline style override for the toggle button. */
  buttonStyle?: CSSProperties;
};

export function TruncatedText({
  text,
  limit = 280,
  buttonStyle,
}: TruncatedTextProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  if (text.length <= limit) {
    return <span>{text}</span>;
  }

  return (
    <span>
      {expanded ? text : `${text.slice(0, limit)}…`}{' '}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          color: 'currentColor',
          textDecoration: 'underline',
          cursor: 'pointer',
          font: 'inherit',
          ...buttonStyle,
        }}
      >
        {expanded ? 'show less' : 'show more'}
      </button>
    </span>
  );
}
