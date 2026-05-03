/**
 * StatusBar — pure presentational status line.
 *
 * Single-line text indicator for current drill state. Owns no logic; the
 * caller passes the already-resolved string from useDrill().
 */

import type { CSSProperties } from 'react';

const styles: CSSProperties = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '14px',
  color: '#333',
  textAlign: 'center',
  marginTop: '12px',
  minHeight: '20px',
};

type StatusBarProps = {
  text: string;
};

export function StatusBar({ text }: StatusBarProps) {
  return <div style={styles}>{text}</div>;
}
