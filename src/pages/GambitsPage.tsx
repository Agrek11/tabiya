/**
 * GambitsPage — dedicated /repertoire/gambits surface (Phase 0d.3).
 *
 * Cross-cuts the family layer: lists every Opening flagged `is_gambit` regardless
 * of which family it primarily belongs to. Empty when no gambits are seeded yet.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Inbox } from 'lucide-react';
import { useTokens } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { Card } from '../ui/primitives/Card';
import { PageHeader } from '../ui/primitives/PageHeader';
import { StateMessage } from '../ui/primitives/StateMessage';
import { getRepository } from '../storage';
import type { Opening } from '../storage/types';

export function GambitsPage() {
  const t = useTokens();
  const navigate = useNavigate();
  const [gambits, setGambits] = useState<Opening[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const repo = getRepository();
    let cancelled = false;
    void (async () => {
      try {
        const list = await repo.listGambits();
        if (!cancelled) setGambits(list);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Link
        to="/repertoire"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12.5,
          fontFamily: fonts.sans,
          color: t.inkDim,
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        <ArrowLeft size={13} /> Back to Repertoire
      </Link>

      <PageHeader
        title="Gambits"
        subtitle={
          gambits === null
            ? 'Loading…'
            : `${gambits.length} gambit${gambits.length === 1 ? '' : 's'} across all families.`
        }
      />

      {error ? (
        <StateMessage icon={Inbox} title="Couldn't load gambits" body={error} iconColor={t.red} />
      ) : gambits === null ? null : gambits.length === 0 ? (
        <StateMessage
          icon={Inbox}
          title="No gambits yet"
          body="The catalog has no openings flagged as true gambits. Add King's Gambit, Evans Gambit, or Smith-Morra to seed this section."
          iconColor={t.inkDim}
        />
      ) : (
        <div
          className="tabiya-openings-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
          }}
        >
          {gambits.map((o) => (
            <Card key={o.id} style={{ cursor: 'pointer', padding: 18 }}>
              <div
                onClick={() => navigate(`/drill?opening=${o.id}`)}
                style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}
              >
                <div style={{ fontFamily: fonts.mono, fontSize: 11, color: t.inkSoft, fontWeight: 600 }}>
                  {o.eco} · {o.color === 'white' ? 'WHITE' : 'BLACK'}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: t.ink, fontFamily: fonts.sans }}>
                  {o.name}
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: t.inkDim, fontFamily: fonts.sans }}>
                    {o.line_ids.length} {o.line_ids.length === 1 ? 'line' : 'lines'}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: t.brand,
                      fontWeight: 700,
                      background: t.brandSoft,
                      padding: '2px 8px',
                      borderRadius: radius.full,
                      fontFamily: fonts.sans,
                    }}
                  >
                    GAMBIT
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    fontSize: 12,
                    color: t.brand,
                    fontWeight: 600,
                    fontFamily: fonts.sans,
                  }}
                >
                  Drill <ChevronRight size={13} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
