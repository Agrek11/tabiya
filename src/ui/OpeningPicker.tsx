/**
 * OpeningPicker — dropdown of all openings in the catalog.
 */

import type { CSSProperties } from 'react';
import type { Opening } from '../storage/types';

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

type OpeningPickerProps = {
  openings: Opening[];
  value: string;
  onChange: (openingId: string) => void;
};

export function OpeningPicker({ openings, value, onChange }: OpeningPickerProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={labelStyle}>Opening</span>
      <select
        style={selectStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {openings.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} ({o.eco})
          </option>
        ))}
      </select>
    </label>
  );
}
