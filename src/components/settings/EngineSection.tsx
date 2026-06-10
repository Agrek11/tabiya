/**
 * EngineSection — Settings card for the Stockfish search preset (Task 4.2).
 *
 * Named profiles only (Fast / Balanced / Deep); no raw depth/multipv knobs
 * (R3.3). Selection persists to localStorage and dispatches the
 * `tabiya:engine-preset-changed` event via `savePresetToStorage` so the Coach
 * cache invalidates immediately (R3.6).
 */

import { useState } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Card } from '../../ui/primitives/Card';
import { CardTitle } from '../../ui/primitives/CardTitle';
import {
  ENGINE_PRESET_NAMES,
  loadPresetFromStorage,
  savePresetToStorage,
  type EnginePresetName,
} from '../../engine/presets';

const PRESET_HINTS: Record<EnginePresetName, string> = {
  Fast: 'depth 12 · 3 lines · ~0.5s. Snappy, shallower.',
  Balanced: 'depth 20 · 3 lines · ~2s. Default.',
  Deep: 'depth 30 · 5 lines · ~5s. Strongest, slower.',
};

export function EngineSection() {
  const t = useTokens();
  const [preset, setPreset] = useState<EnginePresetName>(() => loadPresetFromStorage());

  const choose = (name: EnginePresetName): void => {
    setPreset(name);
    savePresetToStorage(name);
  };

  return (
    <Card>
      <CardTitle>Engine</CardTitle>
      <div
        style={{
          fontSize: 12.5,
          color: t.inkSoft,
          fontFamily: fonts.sans,
          marginTop: -6,
          marginBottom: 12,
          lineHeight: 1.55,
        }}
      >
        How deeply Stockfish analyzes when you ask the Coach "Why?". Deeper is
        stronger but slower.
      </div>
      <div
        role="radiogroup"
        aria-label="Engine preset"
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {ENGINE_PRESET_NAMES.map((name) => {
          const selected = name === preset;
          return (
            <button
              key={name}
              role="radio"
              aria-checked={selected}
              onClick={() => choose(name)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `0.5px solid ${selected ? t.brand : t.border}`,
                background: selected ? t.brandSoft : t.surfaceAlt,
                color: t.ink,
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: selected ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div>{name}</div>
              <div style={{ fontSize: 11, color: t.inkDim, marginTop: 2, fontFamily: fonts.mono }}>
                {PRESET_HINTS[name]}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
