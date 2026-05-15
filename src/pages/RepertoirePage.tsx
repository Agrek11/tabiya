/**
 * RepertoirePage — opening browser matched to v1 preview.
 *
 * Source: specs/wireframes/tabiya-v1-preview.html `data-page="repertoire"`.
 *
 * Layout:
 *   PageHeader
 *   Controls row: search + Due First select + Tier filter select
 *   Color tabs: All / As White / As Black (underline-active, count badges)
 *   Category chips: All / Open / Semi-Open / Closed / Indian / Flank / Gambits
 *   Grid 1.8:1:  opening rows (grouped by family section header) | Context card
 *
 * Section header  = family name (a one-line opener for the category cluster).
 * Opening row     = a single Opening from the catalog, drills to its first
 *                   line on click.
 *
 * Preserves:
 *   - search across family + opening + ECO (live filter)
 *   - color filter (white/black/all)
 *   - category filter (chip selection)
 *   - effective repertoire pick (`useEffectivePick`)
 *   - two-step SRS reset per opening's first line (existing reset semantics)
 *   - keyboard tab/enter navigation via native button semantics
 *
 * Removed (per v1 preview):
 *   - family expand/collapse — rows are always flat, openings always visible
 *   - opening → line drill-down popover — single-click row navigates straight
 *     to that opening's first line
 *   - inline line list under each opening
 *
 * Multi-line openings still drill to their first line by default; switching
 * lines within an opening happens from the Drill toolbar's slick menu.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Inbox, RotateCcw, Search, Swords } from 'lucide-react';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { Insight, InsightStack } from '../ui/primitives/Insight';
import { StateMessage } from '../ui/primitives/StateMessage';
import { getRepository, getSrsRepository } from '../storage';
import { useSRS } from '../hooks/useSRS';
import { useEffectivePick } from '../hooks/useEffectivePick';
import { EventsContextProvider } from '../state/EventsContext';
import { RepertoirePicker } from '../components/repertoire/RepertoirePicker';
import {
  aggregateMasteryByOpening,
} from '../storage/srs/scheduler';
import type { Family, FamilyCategory, Line, Opening } from '../storage/types';

type ColorFilter = 'all' | 'white' | 'black';
type CategoryFilter = 'all' | FamilyCategory;
type SortOption = 'due-first' | 'a-z' | 'by-tier';

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
  return (
    <EventsContextProvider>
      <RepertoirePageBody />
    </EventsContextProvider>
  );
}

function RepertoirePageBody() {
  const t = useTokens();
  const navigate = useNavigate();
  const [families, setFamilies] = useState<Family[] | null>(null);
  const [openings, setOpenings] = useState<Opening[] | null>(null);
  const [lines, setLines] = useState<Line[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<ColorFilter>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOption>('due-first');
  const [tier, setTier] = useState<'all' | '1' | '2' | '3'>('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resetConfirmFor, setResetConfirmFor] = useState<string | null>(null);

  const { states: srsStates, dueLineIds, refresh: refreshSrs } = useSRS();
  const { effective } = useEffectivePick();
  const dueLineIdSet = useMemo(() => new Set(dueLineIds), [dueLineIds]);

  const onResetLine = async (lineId: string): Promise<void> => {
    await getSrsRepository().resetState(lineId);
    setResetConfirmFor(null);
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

  const linesByOpening = useMemo(() => {
    const m = new Map<string, Line[]>();
    if (lines === null) return m;
    for (const ln of lines) {
      const list = m.get(ln.opening_id) ?? [];
      list.push(ln);
      m.set(ln.opening_id, list);
    }
    return m;
  }, [lines]);

  const dueCountByOpening = useMemo(() => {
    const m = new Map<string, number>();
    for (const [opId, opLines] of linesByOpening.entries()) {
      m.set(opId, opLines.filter((l) => dueLineIdSet.has(l.id)).length);
    }
    return m;
  }, [linesByOpening, dueLineIdSet]);

  const filtered = useMemo(() => {
    if (families === null || openings === null) return null;
    const q = search.trim().toLowerCase();
    const familyMap = new Map(families.map((f) => [f.id, f]));

    // Start: all openings that match every filter.
    let filteredOps = openings.filter((o) => {
      // Effective pick — opening passes if at least one of its lines is in the
      // pick.
      if (effective.isFiltered) {
        const opLines = linesByOpening.get(o.id) ?? [];
        if (!opLines.some((l) => effective.lineIds.has(l.id))) return false;
      }
      if (color !== 'all' && o.color !== color) return false;
      const fam = familyMap.get(o.family_id);
      if (category !== 'all' && fam?.category !== category) return false;
      if (q.length > 0) {
        const matchesOpening =
          o.name.toLowerCase().includes(q) || o.eco.toLowerCase().includes(q);
        const matchesFamily = fam?.name.toLowerCase().includes(q) ?? false;
        if (!matchesOpening && !matchesFamily) return false;
      }
      // Tier filter — opening tier inferred from its first line's tier tag
      // (e.g. "tier:1"). Lines without a tier tag pass when "all".
      if (tier !== 'all') {
        const opLines = linesByOpening.get(o.id) ?? [];
        const hasTier = opLines.some((l) =>
          (l.tags ?? []).some((tag) => tag === `tier:${tier}`)
        );
        if (!hasTier) return false;
      }
      return true;
    });

    if (sort === 'a-z') {
      filteredOps = [...filteredOps].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'by-tier') {
      filteredOps = [...filteredOps].sort((a, b) => tierOf(a, linesByOpening) - tierOf(b, linesByOpening));
    } else {
      // due-first: openings with due lines first, then by name.
      filteredOps = [...filteredOps].sort((a, b) => {
        const aDue = dueCountByOpening.get(a.id) ?? 0;
        const bDue = dueCountByOpening.get(b.id) ?? 0;
        if (aDue !== bDue) return bDue - aDue;
        return a.name.localeCompare(b.name);
      });
    }

    return filteredOps;
  }, [families, openings, search, color, category, tier, sort, effective, linesByOpening, dueCountByOpening]);

  const onRowClick = (op: Opening): void => {
    const opLines = linesByOpening.get(op.id) ?? [];
    const first = opLines[0];
    if (first) {
      navigate(`/drill?line=${first.id}`);
    }
  };

  if (error) {
    return (
      <PageBody>
        <PageHeader title="Repertoire" />
        <StateMessage icon={Inbox} title="Couldn't load catalog" body={error} iconColor={t.red} />
      </PageBody>
    );
  }

  if (filtered === null || families === null || openings === null) {
    return (
      <PageBody>
        <PageHeader title="Repertoire" subtitle="Loading…" />
      </PageBody>
    );
  }

  const totalOpenings = openings.length;
  const totalVariations = openings.length; // legacy approximation
  const totalLines = lines?.length ?? 0;
  const subtitle = `${families.length} families · ${totalVariations} variations · ${totalLines} lines. Click any opening to drill.`;
  const whiteCount = openings.filter((o) => o.color === 'white').length;
  const blackCount = openings.filter((o) => o.color === 'black').length;
  const filteredCount = filtered.length;
  const gambitCount = openings.filter((o) => o.is_gambit).length;
  const familyMap = new Map(families.map((f) => [f.id, f]));

  // Group filtered openings under family section headers, preserving the
  // sort order of `filtered` so "Due First" still works across families.
  const rowGroups: Array<{ family: Family; ops: Opening[] }> = [];
  const groupIndex = new Map<string, number>();
  for (const op of filtered) {
    const fam = familyMap.get(op.family_id);
    if (!fam) continue;
    let idx = groupIndex.get(fam.id);
    if (idx === undefined) {
      idx = rowGroups.length;
      groupIndex.set(fam.id, idx);
      rowGroups.push({ family: fam, ops: [] });
    }
    rowGroups[idx]!.ops.push(op);
  }

  return (
    <PageBody>
      <PageHeader
        title="Repertoire"
        subtitle={subtitle}
        actions={
          <button
            onClick={() => setPickerOpen((v) => !v)}
            style={{
              padding: '8px 14px',
              fontFamily: fonts.sans,
              fontSize: 12.5,
              fontWeight: 500,
              background: pickerOpen ? t.brandSoft : t.surface,
              border: `0.5px solid ${pickerOpen ? t.brand : t.border}`,
              color: pickerOpen ? t.brand : t.ink,
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            {pickerOpen ? 'Close picker' : 'Pick repertoire'}
            {effective.isFiltered && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 11,
                  background: t.brand,
                  color: t.brandInk,
                  borderRadius: 999,
                  padding: '1px 7px',
                  fontWeight: 600,
                }}
              >
                {effective.lineIds.size}
              </span>
            )}
          </button>
        }
      />

      {pickerOpen && (
        <div style={{ marginBottom: 18 }}>
          <RepertoirePicker onClose={() => setPickerOpen(false)} />
        </div>
      )}

      {/* CONTROLS ROW */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 18,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 220 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: t.inkSoft,
              pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search families, openings, ECO…"
            style={{
              width: '100%',
              padding: '10px 14px 10px 34px',
              background: t.surface,
              border: `0.5px solid ${t.border}`,
              color: t.ink,
              borderRadius: 12,
              fontSize: 13,
              fontFamily: fonts.sans,
              outline: 'none',
            }}
          />
        </div>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          style={selectPillStyle(t)}
        >
          <option value="due-first">Due First</option>
          <option value="a-z">A-Z</option>
          <option value="by-tier">By Tier</option>
        </select>
        <select
          aria-label="Tier filter"
          value={tier}
          onChange={(e) => setTier(e.target.value as typeof tier)}
          style={selectPillStyle(t)}
        >
          <option value="all">All Levels</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
        <Link
          to="/repertoire/gambits"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 14px',
            background: t.surface,
            border: `0.5px solid ${t.border}`,
            borderRadius: 12,
            fontFamily: fonts.sans,
            fontSize: 12.5,
            fontWeight: 500,
            color: t.ink,
            textDecoration: 'none',
          }}
        >
          <Swords size={13} />
          Gambits
          <span
            style={{
              background: t.surfaceAlt,
              color: t.inkDim,
              fontSize: 11,
              fontWeight: 600,
              padding: '1px 7px',
              borderRadius: 999,
            }}
          >
            {gambitCount}
          </span>
        </Link>
      </div>

      {/* COLOR TABS */}
      <ColorTabs
        color={color}
        onChange={setColor}
        counts={{ all: totalOpenings, white: whiteCount, black: blackCount }}
      />

      {/* CATEGORY CHIPS */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 22 }}>
        {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((cat) => {
          const isActive = category === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '6px 12px',
                background: isActive ? t.brandSoft : 'transparent',
                border: `0.5px solid ${isActive ? t.brandSoftBorder : t.border}`,
                borderRadius: 999,
                color: isActive ? t.brand : t.inkDim,
                fontSize: 11.5,
                fontWeight: 600,
                fontFamily: fonts.sans,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {filteredCount === 0 ? (
        <StateMessage
          icon={Inbox}
          title="No matches"
          body="Try clearing the search or switching filters."
          iconColor={t.inkDim}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 18 }}>
          {/* LEFT: opening rows grouped under family section headers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {rowGroups.map((group) => (
              <div key={group.family.id}>
                <CardTitle style={{ marginBottom: 14 }}>{group.family.name}</CardTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {group.ops.map((op) => {
                    const opLines = linesByOpening.get(op.id) ?? [];
                    const firstLine = opLines[0];
                    const masteryPct = Math.round(masteryByOpening.get(op.id) ?? 0);
                    const dueCount = dueCountByOpening.get(op.id) ?? 0;
                    const tierLabel = formatTier(opLines);
                    const canReset = firstLine ? srsStates.has(firstLine.id) : false;
                    const isResetPending = firstLine ? resetConfirmFor === firstLine.id : false;
                    return (
                      <OpeningRow
                        key={op.id}
                        opening={op}
                        family={group.family}
                        masteryPct={masteryPct}
                        dueCount={dueCount}
                        tierLabel={tierLabel}
                        onClick={() => onRowClick(op)}
                        canReset={canReset}
                        resetPending={isResetPending}
                        onResetRequest={() => firstLine && setResetConfirmFor(firstLine.id)}
                        onResetConfirm={() => firstLine && void onResetLine(firstLine.id)}
                        onResetCancel={() => setResetConfirmFor(null)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: Opening Context card */}
          <div>
            <Card>
              <CardTitle>Opening Context</CardTitle>
              <div
                style={{
                  fontSize: 13,
                  color: t.ink,
                  lineHeight: 1.65,
                  marginBottom: 16,
                  fontFamily: fonts.sans,
                }}
              >
                Showing <strong>{filteredCount}</strong>{' '}
                {filteredCount === 1 ? 'opening' : 'openings'} across{' '}
                <strong>{rowGroups.length}</strong>{' '}
                {rowGroups.length === 1 ? 'family' : 'families'}.
              </div>
              <InsightStack>
                <Insight>Click any opening to drill its first line.</Insight>
                <Insight>Switch lines within an opening from the Drill toolbar.</Insight>
                <Insight>The ↺ button resets SRS state for that opening.</Insight>
              </InsightStack>
            </Card>
          </div>
        </div>
      )}
    </PageBody>
  );
}

function tierOf(op: Opening, byOpening: Map<string, Line[]>): number {
  const opLines = byOpening.get(op.id) ?? [];
  for (const ln of opLines) {
    for (const tag of ln.tags ?? []) {
      if (tag.startsWith('tier:')) return Number(tag.slice(5)) || 9;
    }
  }
  return 9;
}

function formatTier(opLines: Line[]): string | null {
  for (const ln of opLines) {
    for (const tag of ln.tags ?? []) {
      if (tag.startsWith('tier:')) return `T${tag.slice(5)}`;
    }
  }
  return null;
}

function selectPillStyle(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    background: t.surface,
    border: `0.5px solid ${t.border}`,
    color: t.ink,
    padding: '9px 14px',
    borderRadius: 12,
    fontSize: 12.5,
    fontFamily: fonts.sans,
    cursor: 'pointer',
  };
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
  const items: Array<{ key: ColorFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'white', label: 'As White' },
    { key: 'black', label: 'As Black' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        borderBottom: `0.5px solid ${t.border}`,
        marginBottom: 16,
      }}
    >
      {items.map((item) => {
        const isActive = color === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '11px 18px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? t.brand : t.inkDim,
              fontFamily: fonts.sans,
              cursor: 'pointer',
              borderBottom: `2px solid ${isActive ? t.brand : 'transparent'}`,
              marginBottom: -1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            {item.label}
            <span
              style={{
                background: isActive ? t.brandSoft : t.surfaceAlt,
                color: isActive ? t.brand : t.inkSoft,
                fontSize: 11,
                padding: '1px 7px',
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              {counts[item.key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function OpeningRow({
  opening,
  family,
  masteryPct,
  dueCount,
  tierLabel,
  onClick,
  canReset,
  resetPending,
  onResetRequest,
  onResetConfirm,
  onResetCancel,
}: {
  opening: Opening;
  family: Family;
  masteryPct: number;
  dueCount: number;
  tierLabel: string | null;
  onClick: () => void;
  canReset: boolean;
  resetPending: boolean;
  onResetRequest: () => void;
  onResetConfirm: () => void;
  onResetCancel: () => void;
}) {
  const t = useTokens();
  const meta = [
    masteryPct > 0 ? `${masteryPct}% mastery` : 'Drill to track',
    dueCount > 0 ? `${dueCount} due` : null,
    family.category !== 'uncategorized' ? family.category : null,
  ]
    .filter((x) => x !== null)
    .join(' · ');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid={`opening-row-${opening.id}`}
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        background: t.surface,
        border: `0.5px solid ${t.border}`,
        cursor: 'pointer',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = t.brandSoftBorder;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = t.border;
      }}
    >
      <BoardThumb />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: t.ink,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontFamily: fonts.sans,
          }}
        >
          <span>{opening.name}</span>
          {tierLabel && (
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 5,
                background: t.surfaceAlt,
                color: t.inkDim,
                letterSpacing: '0.05em',
              }}
            >
              {tierLabel}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: t.inkSoft,
            marginBottom: 9,
            fontFamily: fonts.sans,
          }}
        >
          {meta || 'No data yet'}
        </div>
        <div
          data-testid="mastery-bar"
          data-percent={masteryPct}
          style={{
            height: 5,
            background: t.surfaceAlt,
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${masteryPct}%`,
              height: '100%',
              background: t.success,
              borderRadius: 999,
            }}
          />
        </div>
      </div>
      {resetPending ? (
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResetConfirm();
            }}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 8,
              background: t.red,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: fonts.sans,
            }}
          >
            Confirm
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResetCancel();
            }}
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '4px 10px',
              borderRadius: 8,
              background: t.surfaceAlt,
              color: t.ink,
              border: `0.5px solid ${t.border}`,
              cursor: 'pointer',
              fontFamily: fonts.sans,
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canReset) onResetRequest();
          }}
          disabled={!canReset}
          aria-label={`Reset SRS for ${opening.name}`}
          title={canReset ? `Reset SRS for ${opening.name}` : 'No SRS state to reset'}
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'transparent',
            border: `0.5px solid ${t.border}`,
            color: canReset ? t.success : t.inkSoft,
            cursor: canReset ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: canReset ? 1 : 0.4,
          }}
        >
          <RotateCcw size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * 4×4 abstract wood-pattern thumbnail. Pure CSS; theme tokens drive colors so
 * it tracks light/dark + the active board theme.
 */
function BoardThumb() {
  const t = useTokens();
  // Standard 4×4 checker pattern.
  const cells = [
    'l', 'd', 'l', 'd',
    'd', 'l', 'd', 'l',
    'l', 'd', 'l', 'd',
    'd', 'l', 'd', 'l',
  ];
  return (
    <div
      aria-hidden
      style={{
        width: 64,
        height: 64,
        borderRadius: 12,
        overflow: 'hidden',
        background: t.surfaceAlt,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        flexShrink: 0,
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            background: c === 'l' ? t.boardLight : t.boardDark,
          }}
        />
      ))}
    </div>
  );
}
