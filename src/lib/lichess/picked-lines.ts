/**
 * Picked-line resolution for the OOB detector (R5 AC3).
 *
 * Non-React mirror of `useEffectivePick`'s load: persisted RepertoirePick +
 * catalog presets + line metadata → `computeEffectivePick` → the final
 * lineId set, then lifted to the detector's `PickedLine` shape (SAN plies +
 * the line's color from its parent Opening).
 *
 * Detection compares against the PICKED repertoire, never the full catalog —
 * a user who picked the Beginner preset is not "out of book" for skipping an
 * Advanced-only sideline.
 */

import {
  getRepertoireRepository,
  getRepository,
  type Preset,
  type RepertoirePreset,
} from '../../storage';
import { computeEffectivePick, type LineMeta } from '../../repertoire/effectivePick';
import type { PickedLine } from './types';

function liftPreset(p: Preset): RepertoirePreset {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    tier_band: p.tier_band,
    family_ids: p.family_ids,
    lines: p.lines ?? [],
    recommended_color: p.recommended_color,
  };
}

export async function loadPickedLines(): Promise<PickedLine[]> {
  const repo = getRepository();
  const [presets, families, openings, pick] = await Promise.all([
    repo.listPresets(),
    repo.listFamilies(),
    repo.listOpenings(),
    getRepertoireRepository().getPick(),
  ]);
  const lineLists = await Promise.all(openings.map((o) => repo.listLines(o.id)));

  const famTier = new Map(families.map((f) => [f.id, f.tier]));
  const meta = new Map<string, LineMeta>();
  const colorByLineId = new Map<string, 'white' | 'black'>();
  const all: { id: string; moves: string[] }[] = [];

  openings.forEach((opening, idx) => {
    for (const line of lineLists[idx]!) {
      meta.set(line.id, {
        familyId: opening.family_id,
        familyTier: famTier.get(opening.family_id) ?? 0,
      });
      colorByLineId.set(line.id, opening.color);
      all.push({ id: line.id, moves: line.moves });
    }
  });

  const effective = computeEffectivePick(
    pick,
    presets.map(liftPreset),
    all.map((l) => l.id),
    meta,
  );

  return all
    .filter((l) => effective.lineIds.has(l.id))
    .map((l) => ({
      id: l.id,
      color: colorByLineId.get(l.id) ?? 'white',
      plies: l.moves,
    }));
}
