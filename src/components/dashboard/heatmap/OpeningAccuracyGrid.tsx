/**
 * OpeningAccuracyGrid — per-family accuracy distribution.
 *
 * Groups events by lineId, computes accuracy, filters lines with fewer than
 * MIN_LINE_COMPLETES_FOR_HEATMAP completed sessions, resolves lineId →
 * familyId via the catalog, and buckets accuracy into 5 ranges. Renders a
 * CSS grid of `Map<familyId, Record<bucket, count>>`.
 *
 * Article 15: cells use the `heatmap-cell` classname so a future board
 * highlight refactor never collides.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTokens } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';
import { getRepository } from '../../../storage';
import type { Family, Opening } from '../../../storage/types';
import type { SessionEvent } from '../../../types/events';

export const MIN_LINE_COMPLETES_FOR_HEATMAP = 5;

interface Bucket {
  label: string;
  test: (pct: number) => boolean;
}

const BUCKETS: readonly Bucket[] = [
  { label: '0-49%', test: (p) => p < 50 },
  { label: '50-69%', test: (p) => p >= 50 && p < 70 },
  { label: '70-84%', test: (p) => p >= 70 && p < 85 },
  { label: '85-94%', test: (p) => p >= 85 && p < 95 },
  { label: '95-100%', test: (p) => p >= 95 },
];

interface CatalogIndex {
  families: Family[];
  lineFamily: Map<string, string>; // lineId → familyId
}

export function OpeningAccuracyGrid({ events }: { events: SessionEvent[] }) {
  const t = useTokens();
  const [catalog, setCatalog] = useState<CatalogIndex | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const repo = getRepository();
        const families = await repo.listFamilies();
        const openings: Opening[] = await repo.listOpenings();
        const opFam = new Map<string, string>();
        for (const o of openings) opFam.set(o.id, o.family_id);
        const lineLists = await Promise.all(openings.map((o) => repo.listLines(o.id)));
        const lineFamily = new Map<string, string>();
        for (const list of lineLists) {
          for (const l of list) {
            const fid = opFam.get(l.opening_id);
            if (fid !== undefined) lineFamily.set(l.id, fid);
          }
        }
        if (!cancelled) setCatalog({ families, lineFamily });
      } catch (err) {
        console.error('OpeningAccuracyGrid catalog load failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (catalog === null) return [];
    // Group events by lineId.
    const byLine = new Map<string, SessionEvent[]>();
    for (const e of events) {
      const arr = byLine.get(e.lineId) ?? [];
      arr.push(e);
      byLine.set(e.lineId, arr);
    }
    // Per-family bucket tally.
    const famBucketCounts = new Map<string, number[]>();
    for (const [lineId, list] of byLine) {
      const completes = list.filter((e) => e.eventType === 'line_complete').length;
      if (completes < MIN_LINE_COMPLETES_FOR_HEATMAP) continue;
      const correct = list.filter((e) => e.eventType === 'move_correct').length;
      const wrong = list.filter((e) => e.eventType === 'move_wrong').length;
      const total = correct + wrong;
      if (total === 0) continue;
      const pct = (correct / total) * 100;
      const bucketIdx = BUCKETS.findIndex((b) => b.test(pct));
      if (bucketIdx < 0) continue;
      const fid = catalog.lineFamily.get(lineId);
      if (fid === undefined) continue;
      const counts = famBucketCounts.get(fid) ?? [0, 0, 0, 0, 0];
      counts[bucketIdx] = (counts[bucketIdx] ?? 0) + 1;
      famBucketCounts.set(fid, counts);
    }
    return catalog.families
      .filter((f) => famBucketCounts.has(f.id))
      .map((f) => ({ family: f, counts: famBucketCounts.get(f.id) ?? [0, 0, 0, 0, 0] }));
  }, [catalog, events]);

  if (catalog === null) {
    return (
      <div style={{ fontSize: 13, color: t.inkSoft, fontFamily: fonts.sans }}>
        Loading catalog…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 13, color: t.inkSoft, fontFamily: fonts.sans }}>
        Drill at least {MIN_LINE_COMPLETES_FOR_HEATMAP} times on a line to start
        seeing per-opening accuracy here.
      </div>
    );
  }

  const maxCount = Math.max(1, ...rows.flatMap((r) => r.counts));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `140px repeat(${BUCKETS.length}, 1fr)`,
          gap: 4,
          alignItems: 'center',
        }}
      >
        <div />
        {BUCKETS.map((b) => (
          <div
            key={b.label}
            style={{
              fontSize: 11,
              fontFamily: fonts.sans,
              color: t.inkSoft,
              textAlign: 'center',
              fontWeight: 600,
            }}
          >
            {b.label}
          </div>
        ))}
        {rows.map(({ family, counts }) => (
          <FamilyRow
            key={family.id}
            family={family}
            counts={counts}
            maxCount={maxCount}
          />
        ))}
      </div>
      <div
        style={{
          fontSize: 11,
          color: t.inkSoft,
          fontFamily: fonts.sans,
          marginTop: 4,
        }}
      >
        Lines with fewer than {MIN_LINE_COMPLETES_FOR_HEATMAP} completed sessions
        are hidden.
      </div>
    </div>
  );
}

function FamilyRow({
  family,
  counts,
  maxCount,
}: {
  family: Family;
  counts: number[];
  maxCount: number;
}) {
  const t = useTokens();
  return (
    <>
      <div
        style={{
          fontSize: 12,
          fontFamily: fonts.sans,
          color: t.ink,
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {family.name}
      </div>
      {counts.map((c, i) => {
        const intensity = c === 0 ? 0 : Math.max(0.18, c / maxCount);
        return (
          <div
            key={i}
            className="heatmap-cell"
            title={`${family.name} · ${BUCKETS[i]!.label}: ${c} line${c === 1 ? '' : 's'}`}
            style={{
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.chip,
              background: c === 0 ? 'transparent' : t.brand,
              opacity: c === 0 ? 0.6 : intensity,
              border: `1px solid ${c === 0 ? t.border : 'transparent'}`,
              fontSize: 11,
              fontFamily: fonts.mono,
              color: c === 0 ? t.inkSoft : '#ffffff',
              fontWeight: 600,
            }}
          >
            {c === 0 ? '' : c}
          </div>
        );
      })}
    </>
  );
}
