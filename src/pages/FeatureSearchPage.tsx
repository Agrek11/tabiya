import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { getGhostLineRepository, getRepository } from '../storage';

type Match = { id: string; name: string; tags: string[]; to: string };

export function FeatureSearchPage(): React.JSX.Element {
  const t = useTokens();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Match[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [ghosts, openings] = await Promise.all([
        getGhostLineRepository().listAll(),
        getRepository().listOpenings(),
      ]);
      if (cancelled) return;
      const openingLines = (
        await Promise.all(
          openings.map(async (o) =>
            (await getRepository().listLines(o.id)).map((l) => ({
              id: l.id,
              name: l.name,
              tags: l.tags,
              to: `/drill?line=${encodeURIComponent(l.id)}`,
            })),
          ),
        )
      ).flat();
      const ghostItems: Match[] = ghosts.map((g) => ({
        id: g.id,
        name: g.name,
        tags: g.tags,
        to: `/drill?line=${encodeURIComponent(g.id)}`,
      }));
      setItems([...openingLines, ...ghostItems]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items.slice(0, 40);
    return items
      .filter((i) => i.tags.some((t) => t.toLowerCase().includes(needle)) || i.name.toLowerCase().includes(needle))
      .slice(0, 100);
  }, [items, query]);

  return (
    <PageBody>
      <PageHeader
        title="Feature/Tag Search"
        subtitle="Search your lines and injected ghost drills by deterministic tags."
      />
      <Card>
        <CardTitle>Search</CardTitle>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try: ghost-line, tactical, pin, iqp..."
          style={{
            width: '100%',
            border: `0.5px solid ${t.border}`,
            borderRadius: 10,
            background: t.surface,
            color: t.ink,
            fontFamily: fonts.sans,
            fontSize: 13,
            padding: '8px 10px',
          }}
        />
      </Card>
      <Card>
        <CardTitle>Matches ({matches.length})</CardTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matches.map((m) => (
            <div key={m.id} style={{ border: `0.5px solid ${t.border}`, borderRadius: 10, padding: 10 }}>
              <div style={{ fontFamily: fonts.sans, color: t.ink, fontSize: 13 }}>
                <b>{m.name}</b>
              </div>
              <div style={{ fontFamily: fonts.sans, color: t.inkSoft, fontSize: 12, marginTop: 2 }}>
                {m.tags.join(', ') || '(no tags)'}
              </div>
              <Link to={m.to} style={{ color: t.brand, fontSize: 12.5, fontFamily: fonts.sans }}>
                Open drill
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </PageBody>
  );
}
