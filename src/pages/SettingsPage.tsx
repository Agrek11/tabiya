/**
 * SettingsPage — preferences and data management.
 *
 * Source: specs/wireframes/tabiya-v1-preview.html `data-page="settings"`.
 *
 * Sections (each in its own Card):
 *   Appearance — light/dark toggle + board theme picker + piece set picker
 *   Sound — on/off + volume slider + Test button
 *   Repertoire Preset — off / preset list (Phase 1.5 picker)
 *   Danger Zone — RED border, two-step confirm Reset SRS
 *   About — catalog attribution
 *
 * All wiring (theme context, board theme context, piece set context, sound
 * settings, SRS reset, preset picker) carried forward from prior surface — only
 * styling was rebuilt to match v1.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Moon,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useTheme, useTokens } from '../theme/ThemeContext';
import { useBoardTheme } from '../theme/BoardThemeContext';
import { usePieceSet } from '../theme/PieceSetContext';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { fonts } from '../theme/tokens';
import { getSettings, playMove, writeSettings, type SoundSettings } from '../sound/sounds';
import { getSrsRepository } from '../storage';
import { usePreset } from '../hooks/usePreset';
import { ResetTelemetryButton } from '../components/settings/ResetTelemetryButton';
import { EngineSection } from '../components/settings/EngineSection';
import { AISection } from '../components/settings/AISection';

export function SettingsPage() {
  const t = useTokens();
  const { scheme, setScheme } = useTheme();
  const { themeId: boardThemeId, setThemeId: setBoardThemeId, options: boardThemeOptions } = useBoardTheme();
  const { id: pieceSetId, setId: setPieceSetId, options: pieceSetOptions } = usePieceSet();
  const [sound, setSoundState] = useState<SoundSettings>(() => getSettings());
  const { preset: activePreset, presets, setPresetId } = usePreset();
  const [srsCount, setSrsCount] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const updateSound = (next: SoundSettings): void => {
    setSoundState(next);
    writeSettings(next);
  };

  useEffect(() => {
    let cancelled = false;
    void getSrsRepository()
      .listAllStates()
      .then((all) => {
        if (!cancelled) setSrsCount(all.length);
      })
      .catch(() => {
        if (!cancelled) setSrsCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [resetMessage]);

  const onResetAll = async (): Promise<void> => {
    await getSrsRepository().resetAll();
    setConfirmReset(false);
    setResetMessage('All SRS progress cleared.');
  };

  const sectionStyle: React.CSSProperties = { marginBottom: 18 };

  return (
    <PageBody>
      <PageHeader
        title="Settings"
        subtitle="Appearance, sound, repertoire preset, and data management."
      />

      {/* APPEARANCE */}
      <div style={sectionStyle}>
        <Card>
          <CardTitle>Appearance</CardTitle>

          <SettingsRow
            label="Theme"
            hint="Toggle between warm light and warm dark themes."
            control={
              <div style={{ display: 'flex', gap: 6 }}>
                <TogglePill
                  active={scheme === 'light'}
                  onClick={() => setScheme('light')}
                  ariaLabel="Light theme"
                >
                  <Sun size={12} />
                  Light
                </TogglePill>
                <TogglePill
                  active={scheme === 'dark'}
                  onClick={() => setScheme('dark')}
                  ariaLabel="Dark theme"
                >
                  <Moon size={12} />
                  Dark
                </TogglePill>
              </div>
            }
          />

          <SettingsRow
            label="Board theme"
            hint={`${boardThemeOptions.length} presets · square colors. "Auto" follows your light/dark theme.`}
            control={
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 8,
                  maxWidth: 460,
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
                        borderRadius: 10,
                        border: `0.5px solid ${isSel ? t.brand : t.border}`,
                        background: isSel ? t.brandSoft : t.surfaceAlt,
                        color: t.ink,
                        fontFamily: fonts.sans,
                        fontSize: 12.5,
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
            }
          />

          <SettingsRow
            label="Piece set"
            hint={`${pieceSetOptions.length} presets · cburnett (default).`}
            control={
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 460 }}>
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
                        borderRadius: 10,
                        border: `0.5px solid ${isSel ? t.brand : t.border}`,
                        background: isSel ? t.brandSoft : t.surfaceAlt,
                        color: t.ink,
                        fontFamily: fonts.sans,
                        fontSize: 12.5,
                        fontWeight: isSel ? 600 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        minWidth: 140,
                      }}
                    >
                      <span>{opt.label}</span>
                      <span style={{ fontSize: 11, color: t.inkSoft, fontWeight: 400 }}>
                        {opt.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            }
          />
        </Card>
      </div>

      {/* SOUND */}
      <div style={sectionStyle}>
        <Card>
          <CardTitle>Sound</CardTitle>
          <SettingsRow
            label="Move sound"
            hint={`Plays on every move during drill. Volume ${Math.round(sound.volume * 100)}%.`}
            control={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <TogglePill
                  active={!sound.muted}
                  onClick={() => updateSound({ ...sound, muted: !sound.muted })}
                  ariaLabel={sound.muted ? 'Unmute' : 'Mute'}
                >
                  {sound.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  {sound.muted ? 'Off' : 'On'}
                </TogglePill>
                <button
                  onClick={() => playMove()}
                  disabled={sound.muted}
                  style={{
                    background: t.surfaceAlt,
                    border: `0.5px solid ${t.border}`,
                    borderRadius: 999,
                    padding: '6px 12px',
                    fontSize: 12,
                    color: t.ink,
                    fontFamily: fonts.sans,
                    fontWeight: 500,
                    cursor: sound.muted ? 'not-allowed' : 'pointer',
                    opacity: sound.muted ? 0.5 : 1,
                  }}
                >
                  Test
                </button>
              </div>
            }
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderTop: `0.5px solid ${t.border}`,
              opacity: sound.muted ? 0.4 : 1,
              pointerEvents: sound.muted ? 'none' : 'auto',
            }}
          >
            <label
              htmlFor="volume-slider"
              style={{ fontSize: 13, color: t.inkDim, fontFamily: fonts.sans, minWidth: 60 }}
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
              onChange={(e) => updateSound({ ...sound, volume: Number(e.target.value) / 100 })}
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
          </div>
        </Card>
      </div>

      {/* REPERTOIRE PRESET */}
      <div style={sectionStyle}>
        <Card>
          <CardTitle>Repertoire Preset</CardTitle>
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
            Filters the Repertoire and Drill picker. "Off" shows all.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <PresetOption
              label="Off — show all"
              hint="Browse the full catalog. No filter."
              selected={activePreset === null}
              onClick={() => setPresetId(null)}
            />
            {presets.map((p) => (
              <PresetOption
                key={p.id}
                label={p.name}
                hint={p.description}
                selected={activePreset?.id === p.id}
                onClick={() => setPresetId(p.id)}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* ENGINE + AI COACH (Phase 4a) */}
      <div style={sectionStyle}>
        <EngineSection />
      </div>
      <div style={sectionStyle}>
        <AISection />
      </div>

      {/* TELEMETRY RESET (Phase 1.5) */}
      <div style={sectionStyle}>
        <ResetTelemetryButton />
      </div>

      {/* DANGER ZONE */}
      <div style={sectionStyle}>
        <Card style={{ border: `0.5px solid ${t.red}` }}>
          <div
            style={{
              color: t.red,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: fonts.sans,
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <AlertTriangle size={14} />
            Danger Zone
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: t.inkDim,
              fontFamily: fonts.sans,
              lineHeight: 1.55,
            }}
          >
            Wipes spaced-repetition progress for every line. Cannot be undone.
          </div>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={srsCount === 0 || srsCount === null}
              style={{
                background: 'transparent',
                border: `0.5px solid ${t.red}`,
                color: t.red,
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: fonts.sans,
                cursor: srsCount === 0 || srsCount === null ? 'not-allowed' : 'pointer',
                marginTop: 10,
                opacity: srsCount === 0 || srsCount === null ? 0.5 : 1,
              }}
            >
              Reset all SRS progress
              {srsCount !== null && srsCount > 0
                ? ` (${srsCount} record${srsCount === 1 ? '' : 's'})`
                : ''}
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginTop: 10,
              }}
            >
              <span style={{ fontSize: 13, color: t.ink, fontFamily: fonts.sans }}>
                Delete {srsCount} record{srsCount === 1 ? '' : 's'}?
              </span>
              <button
                onClick={() => void onResetAll()}
                style={{
                  background: t.red,
                  color: '#fff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: fonts.sans,
                  cursor: 'pointer',
                }}
              >
                Yes, reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                style={{
                  background: t.surfaceAlt,
                  color: t.ink,
                  border: `0.5px solid ${t.border}`,
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 500,
                  fontFamily: fonts.sans,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
          {resetMessage !== null && (
            <div
              style={{
                fontSize: 12,
                color: t.inkDim,
                fontFamily: fonts.sans,
                marginTop: 10,
              }}
            >
              {resetMessage}
            </div>
          )}
        </Card>
      </div>

      {/* ABOUT */}
      <div style={sectionStyle}>
        <Card>
          <CardTitle>About</CardTitle>
          <div
            style={{
              fontSize: 13,
              color: t.inkDim,
              fontFamily: fonts.sans,
              lineHeight: 1.6,
            }}
          >
            tabiya — chess opening drill trainer.
            <br />
            Catalog data from{' '}
            <a
              href="https://github.com/lichess-org/chess-openings"
              target="_blank"
              rel="noreferrer"
              style={{ color: t.brand, fontWeight: 500 }}
            >
              lichess-org/chess-openings
            </a>{' '}
            and the Lichess Masters Opening Explorer.
          </div>
        </Card>
      </div>
    </PageBody>
  );
}

function SettingsRow({
  label,
  hint,
  control,
}: {
  label: string;
  hint: string;
  control: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '12px 0',
        borderTop: `0.5px solid ${t.border}`,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: '1 1 200px' }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.ink, fontFamily: fonts.sans }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: t.inkSoft,
            fontFamily: fonts.sans,
            marginTop: 3,
            lineHeight: 1.55,
          }}
        >
          {hint}
        </div>
      </div>
      <div>{control}</div>
    </div>
  );
}

function TogglePill({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        background: active ? t.brand : t.surfaceAlt,
        border: `0.5px solid ${active ? t.brand : t.border}`,
        color: active ? t.brandInk : t.ink,
        borderRadius: 999,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        fontFamily: fonts.sans,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}

function PresetOption({
  label,
  hint,
  selected,
  onClick,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  const t = useTokens();
  return (
    <button
      onClick={onClick}
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
      <div>{label}</div>
      <div style={{ fontSize: 11, color: t.inkDim, marginTop: 2 }}>{hint}</div>
    </button>
  );
}
