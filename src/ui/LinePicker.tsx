/**
 * LinePicker — dropdown of lines for the currently-selected opening.
 */

import type { CSSProperties } from 'react';
import type { Line } from '../storage/types';

const labelStyle: CSSProperties = {
  fontSize: '12px',
  color: '#555',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const selectStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  background: '#fff',
  fontSize: '14px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  minWidth: '220px',
};

type LinePickerProps = {
  lines: Line[];
  value: string;
  onChange: (lineId: string) => void;
};

export function LinePicker({ lines, value, onChange }: LinePickerProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={labelStyle}>Line</span>
      <select
        style={selectStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={lines.length === 0}
      >
        {lines.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} ({l.depth} ply)
          </option>
        ))}
      </select>
    </label>
  );
}
