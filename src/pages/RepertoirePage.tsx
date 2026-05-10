/**
 * RepertoirePage — family-grouped opening browser (Phase 0d.3).
 *
 * Top-level: family cards (collapsed by default). Click family card to expand
 * and reveal child openings. Search bar across family + opening names + ECO.
 * Filter chips for color (All / White / Black) and category (open / semi-open /
 * closed / indian / flank / gambit / all).
 *
 * Mastery aggregation deferred — gates on Phase 1 SRS.
 *
 * Gambits get their own dedicated surface at /repertoire/gambits.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Inbox, RotateCcw, Search, Swords } from 'lucide-react';
import { useTokens } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { Card } from '../ui/primitives/Card';
import { PageHeader } from '../ui/primitives/PageHeader';
import { StateMessage } from '../ui/primitives/StateMessage';
import { getRepository, getSrsRepository } from '../storage';
import { useSRS } from '../hooks/useSRS';
import { familyPassesPreset, usePreset } from '../hooks/usePreset';
import {
  aggregateMasteryByFamily,
  aggregateMasteryByOpening,
} from '../storage/srs/scheduler';
import type { Family, FamilyCategory, Line, Opening } from '../storage/types';

type ColorFilter = 'all' | 'white' | 'black';
type CategoryFilter = 'all' | FamilyCategory;

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'All',
  open: 'Open',
  'semi-open': 'Semi-Open',
  closed: 'Closed',
  indian: 'Indian',
  flank: 'Flank',
  gambit: 'Gambits',
  uncategorized: 'Uncategorized',
};

export function RepertoirePage() {
  const t = useTokens();
  const navigate = useNavigate();
  const [families, setFamilies] = useState<Family[] | null>(null);
  const [openings, setOpenings] = useState<Opening[] | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<ColorFilter>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { states: srsStates, refresh: refreshSrs } = useSRS();
  const { preset } = usePreset();

  const onResetLine = async (lineId: string): Promise<void> => {
    await getSrsRepository().resetState(lineId);
    await refreshSrs();
  };

  useEffect(() => {
    const repo = getRepository();
    let cancelled = false;
    void (async () => {
      try {
        const [fams, ops] = await Promise.all([repo.listFamilies(), repo.listOpenings()]);
        if (cancelled) return;
        setFamilies(fams);
        setOpenings(ops);
        const allLines = await Promise.all(ops.map((o) => repo.listLines(o.id)));
        if (!cancelled) setLines(allLines.flat());
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const masteryByOpening = useMemo(() => {
    if (lines === null) return new Map<string, number>();
    return aggregateMasteryByOpening(srsStates, lines);
  }, [srsStates, lines]);

  const masteryByFamily = useMemo(() => {
    if (families === null) return new Map<string, number>();
    return aggregateMasteryByFamily(masteryByOpening, families);
  }, [masteryByOpening, families]);

  const openingsById = useMemo(() => {
    const m = new Map<string, Opening>();
    if (openings !== null) for (const o of openings) m.set(o.id, o);
    return m;
  }, [openings]);

  const filtered = useMemo(() => {
    if (families === null || openings === null) return null;
    const q = search.trim().toLowerCase();
    return families
      .filter((f) => familyPassesPreset(f.id, f.tier, preset))
      .filter((f) => category === 'all' || f.category === category)
      .map((f) => {
        const ids = f.opening_ids
          .map((id) => openingsById.get(id))
          .filter((o): o is Opening => o !== undefined)
          .filter((o) => color === 'all' || o.color === color)
          .filter((o) => {
            if (q.length === 0) return true;
            return (
              o.name.toLowerCase().includes(q) ||
              o.eco.toLowerCase().includes(q) ||
              f.name.toLowerCase().includes(q)
            );
          });
        return { family: f, ops: ids };
      })
      .filter((row) => row.ops.length > 0);
  }, [families, openings, openingsById, color, category, search]);

  function toggleFamily(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PageHeader title="Repertoire" />
        <StateMessage icon={Inbox} title="Couldn't load catalog" body={error} iconColor={t.red} />
      </div>
    );
  }

  if (filtered === null || families === null || openings === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PageHeader title="Repertoire" subtitle="Loading…" />
      </div>
    );
  }

  const totalOpenings = openings.length;
  const gambitCount = openings.filter((o) => o.is_gambit).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PageHeader
        title="Repertoire"
        subtitle={`${families.length} families · ${totalOpenings} openings · click a family to expand.`}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: t.inkSoft,
            }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search families, openings, ECO…"
            style={{
              width: '100%',
              padding: '8px 10px 8px 30px',
              fontFamily: fonts.sans,
              fontSize: 13,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: radius.chip,
              color: t.ink,
              outline: 'none',
            }}
          />
        </div>
        <Link
          to="/repertoire/gambits"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: radius.chip,
            fontFamily: fonts.sans,
            fontSize: 13,
            fontWeight: 600,
            color: t.ink,
            textDecoration: 'none',
          }}
        >
          <Swords size={14} />
          Gambits
          <span
            style={{
              background: t.surfaceAlt,
              color: t.inkDim,
              fontSize: 11,
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: radius.full,
              fontFamily: fonts.sans,
            }}
          >
            {gambitCount}
          </span>
        </Link>
      </div>

      <ColorTabs
        color={color}
        onChange={setColor}
        counts={{
          all: totalOpenings,
          white: openings.filter((o) => o.color === 'white').length,
          black: openings.filter((o) => o.color === 'black').length,
        }}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((cat) => {
          const isActive = category === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '5px 11px',
                fontFamily: fonts.sans,
                fontSize: 12,
                fontWeight: 600,
                background: isActive ? t.brandSoft : 'transparent',
                color: isActive ? t.brand : t.inkDim,
                border: `1px solid ${isActive ? t.brand : t.border}`,
                borderRadius: radius.full,
                cursor: 'pointer',
              }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <StateMessage
          icon={Inbox}
          title="No matches"
          body="Try clearing the search or switching filters."
          iconColor={t.inkDim}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(({ family, ops }) => (
            <FamilyCard
              key={family.id}
              family={family}
              openings={ops}
              lines={lines ?? []}
              expanded={expanded.has(family.id)}
              onToggle={() => toggleFamily(family.id)}
              onLineClick={(line) => navigate(`/drill?line=${line.id}`)}
              onOpeningClick={(op) => navigate(`/drill?opening=${op.id}`)}
              onResetLine={(lineId) => void onResetLine(lineId)}
              hasSrsState={(lineId) => srsStates.has(lineId)}
              familyMastery={masteryByFamily.get(family.id) ?? 0}
              openingMastery={masteryByOpening}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ColorTabs({
  color,
  onChange,
  counts,
}: {
  color: ColorFilter;
  onChange: (c: ColorFilter) => void;
  counts: Record<ColorFilter, number>;
}) {
  const t = useTokens();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: `1px solid ${t.border}` }}>
      {(['all', 'white', 'black'] as ColorFilter[]).map((c) => {
        const isActive = color === c;
        const label = c === 'all' ? 'All' : c === 'white' ? 'As White' : 'As Black';
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
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
            {label}
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
              {counts[c]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FamilyCard({
  family,
  openings,
  lines,
  expanded,
  onToggle,
  onOpeningClick,
  onLineClick,
  onResetLine,
  hasSrsState,
  familyMastery,
  openingMastery,
}: {
  family: Family;
  openings: Opening[];
  lines: Line[];
  expanded: boolean;
  onToggle: () => void;
  onOpeningClick: (o: Opening) => void;
  onLineClick: (l: Line) => void;
  onResetLine: (lineId: string) => void;
  hasSrsState: (lineId: string) => boolean;
  familyMastery: number;
  openingMastery: Map<string, number>;
}) {
  const t = useTokens();
  const masteryPct = Math.round(familyMastery);
  const linesByOpening = new Map<string, Line[]>();
  for (const ln of lines) {
    if (!ln.opening_id) continue;
    const list = linesByOpening.get(ln.opening_id) ?? [];
    list.push(ln);
    linesByOpening.set(ln.opening_id, list);
  }
  const totalLines = openings.reduce(
    (sum, o) => sum + (linesByOpening.get(o.id)?.length ?? 0),
    0
  );
  return (
    <Card padding={0}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: 16,
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {expanded ? <ChevronDown size={16} color={t.inkDim} /> : <ChevronRight size={16} color={t.inkDim} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: fonts.mono, fontSize: 11, color: t.inkSoft, fontWeight: 600, marginBottom: 4 }}>
            {family.eco_range || '—'} · {family.category.toUpperCase()}
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: t.ink, fontFamily: fonts.sans }}>
            {family.name}
          </h3>
          <MasteryBar percent={masteryPct} caption={masteryPct > 0 ? `${masteryPct}% mastery` : 'Drill to track'} />
        </div>
        <span style={{ fontSize: 12, color: t.inkDim, fontFamily: fonts.sans, textAlign: 'right' }}>
          {openings.length} {openings.length === 1 ? 'opening' : 'openings'}
          <br />
          <span style={{ fontSize: 11, color: t.inkSoft }}>
            {totalLines} {totalLines === 1 ? 'line' : 'lines'}
          </span>
        </span>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: '6px 0' }}>
          {openings.map((o) => {
            const opPct = Math.round(openingMastery.get(o.id) ?? 0);
            const opLines = linesByOpening.get(o.id) ?? [];

            // Single-line variation: collapse — render one row that drills directly.
            if (opLines.length === 1) {
              const line = opLines[0]!;
              const canReset = hasSrsState(line.id);
              return (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    width: '100%',
                  }}
                >
                  <button
                    onClick={() => onLineClick(line)}
                    className="tabiya-popover-item"
                    style={{
                      flex: 1,
                      padding: '10px 8px 10px 44px',
                      background: 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: fonts.sans,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: fonts.mono, fontSize: 10.5, color: t.inkSoft, fontWeight: 600, marginBottom: 2 }}>
                        {o.eco} · {o.color === 'white' ? 'WHITE' : 'BLACK'}
                        {o.is_gambit ? ' · GAMBIT' : ''}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{o.name}</div>
                      <MasteryBar percent={opPct} caption={opPct > 0 ? `${opPct}% mastery` : 'Not started'} compact />
                    </div>
                    <ChevronRight size={14} color={t.brand} />
                  </button>
                  <ResetIconButton
                    enabled={canReset}
                    onReset={() => onResetLine(line.id)}
                    label={`Reset SRS for ${line.name}`}
                  />
                </div>
              );
            }

            // Multi-line variation: opening header + line rows beneath.
            return (
              <div key={o.id}>
                <button
                  onClick={() => onOpeningClick(o)}
                  className="tabiya-popover-item"
                  style={{
                    width: '100%',
                    padding: '10px 16px 6px 44px',
                    background: 'transparent',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: fonts.sans,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: fonts.mono, fontSize: 10.5, color: t.inkSoft, fontWeight: 600, marginBottom: 2 }}>
                      {o.eco} · {o.color === 'white' ? 'WHITE' : 'BLACK'}
                      {o.is_gambit ? ' · GAMBIT' : ''}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{o.name}</div>
                    <MasteryBar percent={opPct} caption={opPct > 0 ? `${opPct}% mastery` : 'Not started'} compact />
                  </div>
                  <span style={{ fontSize: 11.5, color: t.inkDim }}>
                    {opLines.length} lines
                  </span>
                </button>
                <div style={{ paddingBottom: 6 }}>
                  {opLines.map((line) => {
                    const canReset = hasSrsState(line.id);
                    return (
                      <div
                        key={line.id}
                        style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}
                      >
                        <button
                          onClick={() => onLineClick(line)}
                          className="tabiya-popover-item"
                          style={{
                            flex: 1,
                            padding: '7px 8px 7px 64px',
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: fonts.sans,
                            fontSize: 13,
                            color: t.ink,
                          }}
                        >
                          <span style={{ width: 4, height: 4, borderRadius: 999, background: t.inkSoft }} />
                          <span style={{ flex: 1 }}>{line.name}</span>
                          <span style={{ fontSize: 11, color: t.inkSoft }}>{line.depth} ply</span>
                          <ChevronRight size={12} color={t.brand} />
                        </button>
                        <ResetIconButton
                          enabled={canReset}
                          onReset={() => onResetLine(line.id)}
                          label={`Reset SRS for ${line.name}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ResetIconButton({
  enabled,
  onReset,
  label,
}: {
  enabled: boolean;
  onReset: () => void;
  label: string;
}) {
  const t = useTokens();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (enabled) onReset();
      }}
      disabled={!enabled}
      aria-label={label}
      title={enabled ? label : 'No SRS state to reset'}
      style={{
        width: 36,
        background: 'transparent',
        border: 'none',
        cursor: enabled ? 'pointer' : 'not-allowed',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: enabled ? t.inkDim : t.inkSoft,
        opacity: enabled ? 1 : 0.3,
        padding: 0,
      }}
    >
      <RotateCcw size={13} />
    </button>
  );
}

function MasteryBar({
  percent,
  caption,
  compact = false,
}: {
  percent: number;
  caption: string;
  compact?: boolean;
}) {
  const t = useTokens();
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div data-testid="mastery-bar" data-percent={safe} style={{ marginTop: compact ? 4 : 8 }}>
      <div
        style={{
          height: compact ? 4 : 6,
          background: t.surfaceAlt,
          borderRadius: radius.full,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${safe}%`,
            height: '100%',
            background: safe >= 80 ? t.brand : safe > 0 ? t.brandSoft : 'transparent',
          }}
        />
      </div>
      <span
        style={{
          fontSize: compact ? 10.5 : 11,
          color: t.inkSoft,
          fontFamily: fonts.sans,
          marginTop: 3,
          display: 'block',
        }}
      >
        {caption}
      </span>
    </div>
  );
}
