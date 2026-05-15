/**
 * GamesPage — chess platform integration surface (Phase 3 PKCE).
 *
 * Source: specs/wireframes/tabiya-v1-preview.html `data-page="games"`. All
 * values are placeholders until Phase 3 lands Lichess PKCE OAuth and game
 * import. The Sync button shows a "phase pending" toast as a stub.
 */

import { useState } from 'react';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { Insight, InsightStack } from '../ui/primitives/Insight';
import { GameActivityChart } from '../components/games/GameActivityChart';

export function GamesPage() {
  return (
    <PageBody>
      <PageHeader
        title="Games"
        subtitle="Connect your chess platforms to import games, detect recurring weaknesses, and generate personalized training."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        <Card>
          <CardTitle>Connected Platforms</CardTitle>
          <PlatformRow
            name="Lichess"
            meta="Not connected · sign in to import"
            action={{ label: 'Sync now', tone: 'primary', toast: 'Phase 3 PKCE pending' }}
          />
          <div style={{ marginTop: 12 }}>
            <PlatformRow
              name="Chess.com"
              meta="Sync opening performance and rapid games"
              action={{ label: 'Connect', tone: 'secondary', toast: 'OAuth flow not wired in v1' }}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Sync Summary</CardTitle>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}
          >
            <StatTile label="Imported" value="0" />
            <StatTile label="Analyzed" value="0" />
            <StatTile label="Weaknesses" value="0" />
            <StatTile label="Tracked Openings" value="0" />
          </div>
        </Card>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 18,
          marginTop: 18,
        }}
      >
        <Card>
          <CardTitle>Recent Game Activity</CardTitle>
          <GameActivityChart />
        </Card>
        <Card>
          <CardTitle>Detected Patterns</CardTitle>
          <InsightStack>
            <Insight>Connect a platform to surface accuracy patterns from your games.</Insight>
            <Insight>Phase 3 will detect recurring weaknesses across openings.</Insight>
            <Insight>Sicilian retention trend opens up once Lichess sync is wired.</Insight>
          </InsightStack>
        </Card>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 18,
          marginTop: 18,
        }}
      >
        <Card>
          <CardTitle>Weakest Openings</CardTitle>
          <InsightStack>
            <Insight>—</Insight>
            <Insight>Wire pending Phase 3 PKCE</Insight>
          </InsightStack>
        </Card>
        <Card>
          <CardTitle>Most Improved</CardTitle>
          <InsightStack>
            <Insight>—</Insight>
            <Insight>Wire pending Phase 3 PKCE</Insight>
          </InsightStack>
        </Card>
        <Card>
          <CardTitle>Training Recommendations</CardTitle>
          <InsightStack>
            <Insight>—</Insight>
            <Insight>Wire pending Phase 3 PKCE</Insight>
          </InsightStack>
        </Card>
      </div>
    </PageBody>
  );
}

function PlatformRow({
  name,
  meta,
  action,
}: {
  name: string;
  meta: string;
  action: { label: string; tone: 'primary' | 'secondary'; toast: string };
}) {
  const t = useTokens();
  const [toast, setToast] = useState<string | null>(null);
  const onClick = (): void => {
    setToast(action.toast);
    window.setTimeout(() => setToast(null), 1800);
  };
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 14,
        background: t.surfaceAlt,
        border: `0.5px solid ${t.border}`,
        position: 'relative',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: t.ink,
            marginBottom: 3,
            fontFamily: fonts.sans,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: t.inkSoft, fontFamily: fonts.sans }}>
          {meta}
        </div>
      </div>
      <button
        onClick={onClick}
        style={
          action.tone === 'primary'
            ? {
                background: t.brand,
                color: t.brandInk,
                border: 'none',
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: fonts.sans,
                cursor: 'pointer',
              }
            : {
                background: t.surface,
                color: t.ink,
                border: `0.5px solid ${t.border}`,
                padding: '8px 14px',
                borderRadius: 12,
                fontSize: 12.5,
                fontWeight: 500,
                fontFamily: fonts.sans,
                cursor: 'pointer',
              }
        }
      >
        {action.label}
      </button>
      {toast && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: -36,
            right: 8,
            background: t.ink,
            color: t.bg,
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: fonts.sans,
            boxShadow: t.shadowMd,
            zIndex: 5,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const t = useTokens();
  return (
    <div
      style={{
        background: t.surfaceAlt,
        borderRadius: 12,
        padding: 14,
        fontFamily: fonts.sans,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          color: t.inkSoft,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 600,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.ink }}>{value}</div>
    </div>
  );
}
