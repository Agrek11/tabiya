/**
 * SettingsPage — theme toggle, sound, About, version stamp.
 */

import { useState } from 'react';
import { Moon, Sun, Volume2, VolumeX } from 'lucide-react';
import { useTheme, useTokens } from '../theme/ThemeContext';
import { useBoardTheme } from '../theme/BoardThemeContext';
import { usePieceSet } from '../theme/PieceSetContext';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { Button } from '../ui/primitives/Button';
import { fonts, radius } from '../theme/tokens';
import { getSettings, playMove, writeSettings, type SoundSettings } from '../sound/sounds';

export function SettingsPage() {
  const t = useTokens();
  const { scheme, setScheme } = useTheme();
  const { themeId: boardThemeId, setThemeId: setBoardThemeId, options: boardThemeOptions } = useBoardTheme();
  const { id: pieceSetId, setId: setPieceSetId, options: pieceSetOptions } = usePieceSet();
  const [sound, setSoundState] = useState<SoundSettings>(() => getSettings());

  const updateSound = (next: SoundSettings): void => {
    setSoundState(next);
    writeSettings(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      <PageHeader title="Settings" subtitle="Preferences and account." />

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: t.ink,
                fontFamily: fonts.sans,
              }}
            >
              Appearance
            </div>
            <div
              style={{
                fontSize: 13,
                color: t.inkDim,
                marginTop: 4,
                fontFamily: fonts.sans,
              }}
            >
              Switch between light and dark themes.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              variant={scheme === 'light' ? 'primary' : 'secondary'}
              onClick={() => setScheme('light')}
            >
              <Sun size={14} /> Light
            </Button>
            <Button
              variant={scheme === 'dark' ? 'primary' : 'secondary'}
              onClick={() => setScheme('dark')}
            >
              <Moon size={14} /> Dark
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: t.ink,
            fontFamily: fonts.sans,
            marginBottom: 4,
          }}
        >
          Board theme
        </div>
        <div
          style={{
            fontSize: 13,
            color: t.inkDim,
            fontFamily: fonts.sans,
            marginBottom: 12,
          }}
        >
          Square colors. "Auto" follows your light/dark theme.
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}
        >
          {boardThemeOptions.map((opt) => {
            const isSel = opt.id === boardThemeId;
            return (
              <button
                key={opt.id}
                onClick={() => setBoardThemeId(opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: radius.chip,
                  border: `1px solid ${isSel ? t.brand : t.border}`,
                  background: isSel ? t.brandSoft : t.surfaceAlt,
                  color: t.ink,
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  fontWeight: isSel ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 28,
                    height: 18,
                    borderRadius: 3,
                    background: `linear-gradient(to right, ${opt.light} 50%, ${opt.dark} 50%)`,
                    border: `1px solid ${t.border}`,
                    flexShrink: 0,
                  }}
                />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: t.ink,
            fontFamily: fonts.sans,
            marginBottom: 4,
          }}
        >
          Piece set
        </div>
        <div
          style={{
            fontSize: 13,
            color: t.inkDim,
            fontFamily: fonts.sans,
            marginBottom: 12,
          }}
        >
          Visual style of the chess pieces. Classic uses the library default; alt sets ship as scaffolds for testing.
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {pieceSetOptions.map((opt) => {
            const isSel = opt.id === pieceSetId;
            return (
              <button
                key={opt.id}
                onClick={() => setPieceSetId(opt.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '10px 14px',
                  borderRadius: radius.chip,
                  border: `1px solid ${isSel ? t.brand : t.border}`,
                  background: isSel ? t.brandSoft : t.surfaceAlt,
                  color: t.ink,
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  fontWeight: isSel ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  minWidth: 160,
                }}
              >
                <span>{opt.label}</span>
                <span style={{ fontSize: 11, color: t.inkDim, fontWeight: 400 }}>
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: t.ink,
                fontFamily: fonts.sans,
              }}
            >
              Sound effects
            </div>
            <div
              style={{
                fontSize: 13,
                color: t.inkDim,
                marginTop: 4,
                fontFamily: fonts.sans,
              }}
            >
              Plays a tap on every move during drill.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              variant={!sound.muted ? 'primary' : 'secondary'}
              onClick={() => updateSound({ ...sound, muted: false })}
              aria-label="Unmute"
            >
              <Volume2 size={14} /> On
            </Button>
            <Button
              variant={sound.muted ? 'primary' : 'secondary'}
              onClick={() => updateSound({ ...sound, muted: true })}
              aria-label="Mute"
            >
              <VolumeX size={14} /> Off
            </Button>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            opacity: sound.muted ? 0.4 : 1,
            pointerEvents: sound.muted ? 'none' : 'auto',
          }}
        >
          <label
            htmlFor="volume-slider"
            style={{
              fontSize: 13,
              color: t.inkDim,
              fontFamily: fonts.sans,
              minWidth: 60,
            }}
          >
            Volume
          </label>
          <input
            id="volume-slider"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(sound.volume * 100)}
            disabled={sound.muted}
            onChange={(e) =>
              updateSound({ ...sound, volume: Number(e.target.value) / 100 })
            }
            style={{ flex: 1, accentColor: t.brand }}
            aria-label="Volume"
          />
          <span
            style={{
              fontSize: 12,
              color: t.inkSoft,
              fontFamily: fonts.mono,
              minWidth: 36,
              textAlign: 'right',
            }}
          >
            {Math.round(sound.volume * 100)}%
          </span>
          <button
            onClick={() => playMove()}
            disabled={sound.muted}
            style={{
              padding: '6px 12px',
              borderRadius: radius.chip,
              border: `1px solid ${t.border}`,
              background: t.surfaceAlt,
              color: t.ink,
              fontSize: 12,
              fontFamily: fonts.sans,
              cursor: sound.muted ? 'not-allowed' : 'pointer',
            }}
          >
            Test
          </button>
        </div>
      </Card>

      <Card>
        <div
          style={{
            fontWeight: 600,
            fontSize: 14,
            color: t.ink,
            fontFamily: fonts.sans,
            marginBottom: 8,
          }}
        >
          About
        </div>
        <div style={{ fontSize: 13, color: t.inkDim, fontFamily: fonts.sans, lineHeight: 1.5 }}>
          tabiya — chess opening drill trainer. Phase 0d.2.
          <br />
          Catalog data from{' '}
          <a
            href="https://github.com/lichess-org/chess-openings"
            target="_blank"
            rel="noreferrer"
            style={{ color: t.brand }}
          >
            lichess-org/chess-openings
          </a>{' '}
          and the Lichess Masters Opening Explorer.
        </div>
      </Card>
    </div>
  );
}
