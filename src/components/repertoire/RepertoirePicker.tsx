/**
 * RepertoirePicker — preset radio + per-line additions/removals UI.
 *
 * State model:
 *   - PresetRadio (one of: off, beginner, intermediate, advanced)
 *   - ShowAllToggle: when off, only preset members + additions render in the
 *     line list; when on, the full catalog renders so users can add/remove
 *     freely.
 *   - LineCheckbox: toggling a member adds/removes from `removals`; toggling
 *     a non-member adds/removes from `additions`.
 *
 * Preset switch with non-empty deltas opens a confirm modal (R5.7). Cancel
 * keeps the prior preset; Confirm clears both delta lists and switches.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';
import { useEffectivePick } from '../../hooks/useEffectivePick';
import { getRepository } from '../../storage';
import type { Family, Line, Opening } from '../../storage/types';

type CatalogIdx = {
  families: Family[];
  openings: Opening[];
  lines: Line[];
  opFamily: Map<string, string>;
  linesByFamily: Map<string, Line[]>;
};

export function RepertoirePicker({ onClose }: { onClose: () => void }) {
  const t = useTokens();
  const { pick, presets, effective, savePick } = useEffectivePick();
  const [catalog, setCatalog] = useState<CatalogIdx | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const repo = getRepository();
      const [families, openings] = await Promise.all([
        repo.listFamilies(),
        repo.listOpenings(),
      ]);
      const lineLists = await Promise.all(openings.map((o) => repo.listLines(o.id)));
      const lines = lineLists.flat();
      const opFamily = new Map<string, string>();
      for (const o of openings) opFamily.set(o.id, o.family_id);
      const linesByFamily = new Map<string, Line[]>();
      for (const l of lines) {
        const fid = opFamily.get(l.opening_id);
        if (fid === undefined) continue;
        const arr = linesByFamily.get(fid) ?? [];
        arr.push(l);
        linesByFamily.set(fid, arr);
      }
      if (!cancelled) {
        setCatalog({ families, openings, lines, opFamily, linesByFamily });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activePreset = presets.find((p) => p.id === pick.presetId) ?? presets[0]!;
  const presetMembers = useMemo(
    () => new Set(activePreset.lines),
    [activePreset]
  );

  const hasDeltas = pick.additions.length > 0 || pick.removals.length > 0;

  const requestPresetChange = (id: string): void => {
    if (id === pick.presetId) return;
    if (hasDeltas) {
      setConfirmTarget(id);
      return;
    }
    void savePick({ presetId: id, additions: [], removals: [] });
  };

  const confirmPresetChange = (): void => {
    if (confirmTarget === null) return;
    void savePick({ presetId: confirmTarget, additions: [], removals: [] });
    setConfirmTarget(null);
  };

  const toggleLine = (lineId: string): void => {
    const isMember = presetMembers.has(lineId);
    const additions = new Set(pick.additions);
    const removals = new Set(pick.removals);
    if (isMember) {
      // Toggle removals.
      if (removals.has(lineId)) removals.delete(lineId);
      else removals.add(lineId);
    } else {
      // Toggle additions.
      if (additions.has(lineId)) additions.delete(lineId);
      else additions.add(lineId);
    }
    void savePick({
      presetId: pick.presetId,
      additions: Array.from(additions),
      removals: Array.from(removals),
    });
  };

  const toggleFamily = (fid: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fid)) next.delete(fid);
      else next.add(fid);
      return next;
    });
  };

  if (catalog === null) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: t.inkSoft, fontFamily: fonts.sans }}>
          Loading…
        </div>
      </Card>
    );
  }

  return (
    <Card padding={16}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: fonts.sans,
              color: t.ink,
            }}
          >
            Active preset: {activePreset.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: t.inkSoft,
              fontFamily: fonts.sans,
              marginTop: 2,
            }}
          >
            {effective.lineIds.size} effective line
            {effective.lineIds.size === 1 ? '' : 's'}
            {hasDeltas && (
              <span style={{ marginLeft: 6, color: t.brand }}>
                · {pick.additions.length} added · {pick.removals.length} removed
              </span>
            )}
          </div>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>

      {/* PresetRadio */}
      <div
        role="radiogroup"
        aria-label="Repertoire preset"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}
      >
        {presets.map((p) => {
          const isSel = p.id === pick.presetId;
          return (
            <button
              key={p.id}
              role="radio"
              aria-checked={isSel}
              onClick={() => requestPresetChange(p.id)}
              style={{
                padding: '6px 12px',
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: isSel ? 600 : 500,
                background: isSel ? t.brandSoft : t.surface,
                color: isSel ? t.brand : t.ink,
                border: `1px solid ${isSel ? t.brand : t.border}`,
                borderRadius: radius.chip,
                cursor: 'pointer',
              }}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: t.inkDim,
          fontFamily: fonts.sans,
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => setShowAll(e.target.checked)}
        />
        Show all catalog lines
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {catalog.families.map((f) => {
          const famLines = catalog.linesByFamily.get(f.id) ?? [];
          const visibleLines = showAll
            ? famLines
            : famLines.filter(
                (l) =>
                  presetMembers.has(l.id) || pick.additions.includes(l.id)
              );
          if (visibleLines.length === 0) return null;
          const isOpen = expanded.has(f.id);
          return (
            <div
              key={f.id}
              style={{
                border: `1px solid ${t.border}`,
                borderRadius: radius.chip,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => toggleFamily(f.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.ink,
                }}
              >
                <span>{f.name}</span>
                <span style={{ fontSize: 11, color: t.inkSoft }}>
                  {visibleLines.filter((l) => effective.lineIds.has(l.id)).length}/{visibleLines.length}
                </span>
              </button>
              {isOpen && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderTop: `1px solid ${t.border}`,
                  }}
                >
                  {visibleLines.map((l) => {
                    const isMember = presetMembers.has(l.id);
                    const inAdditions = pick.additions.includes(l.id);
                    const inRemovals = pick.removals.includes(l.id);
                    const isEffectivelyChecked = effective.lineIds.has(l.id);
                    return (
                      <label
                        key={l.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 12px',
                          fontFamily: fonts.sans,
                          fontSize: 12.5,
                          color: t.ink,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isEffectivelyChecked}
                          onChange={() => toggleLine(l.id)}
                          aria-label={l.name}
                        />
                        <span style={{ flex: 1 }}>{l.name}</span>
                        {isMember && inRemovals && (
                          <span style={{ fontSize: 10, color: t.red }}>removed</span>
                        )}
                        {!isMember && inAdditions && (
                          <span style={{ fontSize: 10, color: t.brand }}>added</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirmTarget !== null && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setConfirmTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: t.surface,
              padding: 20,
              borderRadius: radius.chip,
              maxWidth: 400,
              border: `1px solid ${t.border}`,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: t.ink, marginBottom: 8, fontFamily: fonts.sans }}>
              Switch preset?
            </div>
            <div style={{ fontSize: 13, color: t.inkDim, marginBottom: 16, fontFamily: fonts.sans }}>
              You have {pick.additions.length} added and {pick.removals.length} removed line(s). Switching to{' '}
              <strong>{presets.find((p) => p.id === confirmTarget)?.name ?? confirmTarget}</strong>{' '}
              will clear those overrides.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setConfirmTarget(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={confirmPresetChange}>
                Switch
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
