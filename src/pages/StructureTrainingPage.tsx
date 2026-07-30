import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { getGhostLineRepository } from '../storage';

type Bucket = { structure: string; count: number; lineIds: string[] };

function classifyStructure(tags: string[]): string {
  if (tags.some((t) => t.includes('iqp'))) return 'IQP';
  if (tags.some((t) => t.includes('stonewall'))) return 'Stonewall';
  if (tags.some((t) => t.includes('maroczy'))) return 'Maroczy';
  if (tags.some((t) => t.includes('symmetric'))) return 'Symmetric';
  return 'General Structure';
}

export function StructureTrainingPage(): React.JSX.Element {
  const t = useTokens();
  const [buckets, setBuckets] = useState<Bucket[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ghosts = await getGhostLineRepository().listAll();
      if (cancelled) return;
      const by = new Map<string, { count: number; lineIds: string[] }>();
      for (const g of ghosts) {
        const structure = classifyStructure(g.tags);
        const cur = by.get(structure) ?? { count: 0, lineIds: [] };
        cur.count += 1;
        cur.lineIds.push(g.id);
        by.set(structure, cur);
      }
      setBuckets(
        [...by.entries()]
          .map(([structure, v]) => ({ structure, count: v.count, lineIds: v.lineIds }))
          .sort((a, b) => b.count - a.count),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageBody>
      <PageHeader
        title="Structure-first Training"
        subtitle="Train by recurring structure classes from your injected ghost corrections."
      />
      <Card>
        <CardTitle>Structure Buckets</CardTitle>
        {buckets.length === 0 ? (
          <p style={{ margin: 0, color: t.inkSoft, fontFamily: fonts.sans, fontSize: 13 }}>
            No structure buckets yet. Add ghost candidates from game review first.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {buckets.map((b) => (
              <div key={b.structure} style={{ border: `0.5px solid ${t.border}`, borderRadius: 10, padding: 10 }}>
                <div style={{ fontFamily: fonts.sans, fontSize: 13, color: t.ink }}>
                  <b>{b.structure}</b> · {b.count} drill{b.count === 1 ? '' : 's'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {b.lineIds.slice(0, 8).map((id) => (
                    <Link key={id} to={`/drill?line=${encodeURIComponent(id)}`} style={{ color: t.brand, fontSize: 12, fontFamily: fonts.mono }}>
                      {id}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageBody>
  );
}
