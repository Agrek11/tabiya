/**
 * SettingsPage — theme toggle, About, version stamp.
 */

import { Moon, Sun } from 'lucide-react';
import { useTheme, useTokens } from '../theme/ThemeContext';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { Button } from '../ui/primitives/Button';
import { fonts } from '../theme/tokens';

export function SettingsPage() {
  const t = useTokens();
  const { scheme, setScheme } = useTheme();

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
            marginBottom: 8,
          }}
        >
          About
        </div>
        <div style={{ fontSize: 13, color: t.inkDim, fontFamily: fonts.sans, lineHeight: 1.5 }}>
          tabiya — chess opening drill trainer. Phase 0d.1.
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
