/**
 * RepertoirePage — opening grid with v1 cards.
 *
 * Phase 0d.1: Real opening list from catalog. Mastery bars render as ghost
 * 0% placeholders with caption "Drill to track mastery" — the bar component
 * shape is rendered but no fake percentage is shown until SRS lands.
 *
 * Side filters (All / White / Black) work today (catalog has color field).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Inbox } from 'lucide-react';
import { useTokens } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { Card } from '../ui/primitives/Card';
import { PageHeader } from '../ui/primitives/PageHeader';
import { StateMessage } from '../ui/primitives/StateMessage';
import { getRepository } from '../storage';
import type { Opening } from '../storage/types';

type Filter = 'all' | 'white' | 'black';

export function RepertoirePage() {
  const t = useTokens();
  const navigate = useNavigate();
  const [openings, setOpenings] = useState<Opening[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const repo = getRepository();
    let cancelled = false;
    void (async () => {
      try {
        const list = await repo.listOpenings();
        if (!cancelled) setOpenings(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (openings === null) return null;
    if (filter === 'all') return openings;
    return openings.filter((o) => o.color === filter);
  }, [openings, filter]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PageHeader title="Repertoire" />
        <StateMessage icon={Inbox} title="Couldn't load catalog" body={error} iconColor={t.red} />
      </div>
    );
  }

  if (filtered === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PageHeader title="Repertoire" subtitle="Loading…" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Repertoire"
        subtitle={`${openings?.length ?? 0} openings · click any to drill it.`}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: `1px solid ${t.border}` }}>
        {[
          { id: 'all' as const, label: 'All', count: openings?.length ?? 0 },
          { id: 'white' as const, label: 'As White', count: openings?.filter((o) => o.color === 'white').length ?? 0 },
          { id: 'black' as const, label: 'As Black', count: openings?.filter((o) => o.color === 'black').length ?? 0 },
        ].map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '10px 14px',
                fontFamily: fonts.sans,
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? t.ink : t.inkDim,
                cursor: 'pointer',
                borderBottom: `2px solid ${isActive ? t.brand : 'transparent'}`,
                marginBottom: -1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {tab.label}
              <span
                style={{
                  background: isActive ? t.brandSoft : t.surfaceAlt,
                  color: isActive ? t.brand : t.inkDim,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: radius.full,
                  fontFamily: fonts.sans,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="tabiya-openings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {filtered.map((o) => (
          <OpeningCard
            key={o.id}
            opening={o}
            onClick={() => navigate(`/drill?opening=${o.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function OpeningCard({ opening, onClick }: { opening: Opening; onClick: () => void }) {
  const t = useTokens();
  return (
    <Card style={{ cursor: 'pointer', padding: 18 }} >
      <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontFamily: fonts.mono, fontSize: 11, color: t.inkSoft, fontWeight: 600, marginBottom: 4 }}>
              {opening.eco} · {opening.color === 'white' ? 'WHITE' : 'BLACK'}
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: t.ink, letterSpacing: -0.2, fontFamily: fonts.sans }}>
              {opening.name}
            </h3>
          </div>
        </div>

        {/* Ghost mastery bar — placeholder for SRS data */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: t.inkDim, fontFamily: fonts.sans }}>
              {opening.line_ids.length} lines
            </span>
            <span style={{ fontSize: 11, color: t.inkSoft, fontFamily: fonts.sans }}>
              Drill to track
            </span>
          </div>
          <div style={{ height: 6, background: t.surfaceAlt, borderRadius: radius.full, overflow: 'hidden' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', fontSize: 12, color: t.brand, fontWeight: 600, fontFamily: fonts.sans }}>
          Drill <ChevronRight size={13} />
        </div>
      </div>
    </Card>
  );
}
