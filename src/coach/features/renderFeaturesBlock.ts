/**
 * renderFeaturesBlock — PositionFeatures → compact prose for prompt v2
 * (Phase 4b). Emits ONLY non-empty / non-default facts: an empty pawn-structure
 * or no tactics produces no lines, keeping the prompt (and Haiku cost) lean.
 * The output is the narrator's VERIFIED FACTS section — every line is a fact
 * the LLM is allowed to cite, nothing it must invent.
 */

import type {
  KingSafetySide,
  PerSide,
  PositionFeatures,
  Side,
} from './PositionFeatures';

function bothSides<T>(
  per: PerSide<T>,
  fmt: (v: T, side: Side) => string | null,
): string[] {
  return (['white', 'black'] as const)
    .map((side) => fmt(per[side], side))
    .filter((s): s is string => s !== null);
}

function list(squares: string[]): string {
  return squares.join(', ');
}

function pawnLines(f: PositionFeatures['pawns']): string[] {
  const out: string[] = [];
  const each = (label: string, per: PerSide<string[]>): void => {
    out.push(
      ...bothSides(per, (sqs, side) => (sqs.length ? `${side} ${label}: ${list(sqs)}` : null)),
    );
  };
  each('doubled pawns', f.doubled);
  each('isolated pawns', f.isolated);
  each('backward pawns', f.backward);
  each('passed pawns', f.passed);
  each('candidate passers', f.candidate_passers);
  if (f.iqp) out.push(`${f.iqp} has an isolated queen's pawn`);
  if (f.hanging_duo) out.push(`${f.hanging_duo} has hanging pawns (c+d)`);
  const maj = (['queenside', 'kingside', 'center'] as const)
    .filter((w) => f.majorities[w])
    .map((w) => `${f.majorities[w]} ${w} majority`);
  if (maj.length) out.push(maj.join('; '));
  out.push(
    ...bothSides(f.chains, (chains, side) =>
      chains.length
        ? `${side} pawn chain${chains.length > 1 ? 's' : ''}: ${chains
            .map((c) => `${c.base}→${c.head}`)
            .join(', ')}`
        : null,
    ),
  );
  return out;
}

function kingLine(k: KingSafetySide, side: Side): string | null {
  const bits: string[] = [];
  if (k.castled !== 'none') bits.push(`castled ${k.castled}, shield ${k.shield}`);
  else bits.push('uncastled');
  if (k.adjacent_open_files.length) bits.push(`open file(s) ${list(k.adjacent_open_files)} near king`);
  if (k.adjacent_half_open_files.length)
    bits.push(`half-open file(s) ${list(k.adjacent_half_open_files)} near king`);
  if (k.king_zone_attackers >= 2) bits.push(`${k.king_zone_attackers} attackers in king zone`);
  // Skip a fully quiet, uncastled-only line with nothing notable.
  if (bits.length === 1 && bits[0] === 'uncastled') return null;
  return `${side} king: ${bits.join('; ')}`;
}

function activityLines(a: PositionFeatures['activity']): string[] {
  const out: string[] = [];
  out.push(
    ...bothSides(a.outposts, (o, side) => {
      const parts: string[] = [];
      if (o.occupied.length) parts.push(`outpost piece(s) ${list(o.occupied)}`);
      if (o.available.length) parts.push(`outpost square(s) ${list(o.available)}`);
      return parts.length ? `${side}: ${parts.join('; ')}` : null;
    }),
  );
  out.push(...bothSides(a.bad_bishop, (b, side) => (b ? `${side} bad bishop on ${b}` : null)));
  out.push(
    ...bothSides(a.trapped, (t, side) => (t.length ? `${side} trapped: ${list(t)}` : null)),
  );
  if (a.tempo.development_lead !== 'even') out.push(`development lead: ${a.tempo.development_lead}`);
  return out;
}

function filesLines(f: PositionFeatures['files_diagonals']): string[] {
  const out: string[] = [];
  if (f.open_files.length) out.push(`open file(s): ${list(f.open_files)}`);
  out.push(
    ...bothSides(f.rooks_on_open, (r, side) => (r.length ? `${side} rook(s) on open file: ${list(r)}` : null)),
  );
  out.push(
    ...bothSides(f.rook_on_seventh, (r, side) => (r.length ? `${side} rook on 7th: ${list(r)}` : null)),
  );
  return out;
}

/** Speculative motifs are prefixed "possible" so the narrator hedges them. */
function tag(text: string, confidence: 'high' | 'speculative'): string {
  return confidence === 'speculative' ? `possible ${text}` : text;
}

/** 4c.1 validated motifs — preferred over raw geometry when present. */
function motifLines(m: PositionFeatures['motifs']): string[] {
  if (!m) return [];
  const out: string[] = [];
  for (const f of m.forks) out.push(tag(`fork: ${f.by} forks ${list(f.targets)}`, f.confidence));
  for (const s of m.skewers) out.push(tag(`skewer: ${s.by} skewers ${s.front} to ${s.back}`, s.confidence));
  for (const b of m.batteries) out.push(tag(`battery: ${list(b.pieces)} bearing on ${b.target}`, b.confidence));
  for (const p of m.pins) out.push(tag(`${p.kind} pin: ${p.by} pins ${p.pinned} to ${p.to}`, p.confidence));
  for (const r of m.removing_defender) {
    out.push(tag(`removing the defender: ${r.defender} is overloaded guarding ${list(r.abandons)}`, r.confidence));
  }
  for (const h of m.hanging) out.push(tag(`hanging: ${h.piece} can be taken by ${h.by}`, h.confidence));
  return out;
}

/** Raw geometry fallback — used only when no validated motifs group exists
 *  (pre-v4 sidecar). When motifs ARE present they supersede pins/overload/
 *  en-prise to avoid double-stating the same fact. */
function geometryLines(t: PositionFeatures['tactics_geometry']): string[] {
  const out: string[] = [];
  for (const p of t.pins) {
    out.push(`${p.absolute ? 'absolute' : 'relative'} pin: ${p.by} pins ${p.pinned} to ${p.to}`);
  }
  for (const o of t.overloaded) out.push(`overloaded: ${o.piece} defends ${list(o.defends)}`);
  for (const d of t.discovered_candidates) {
    out.push(`discovered-attack candidate: moving ${d.mover} unveils ${d.battery_piece} on ${d.target}`);
  }
  if (t.en_prise.length) out.push(`en prise (attacked > defended): ${list(t.en_prise)}`);
  return out;
}

/** Full features block. Returns '' when nothing notable (caller may skip). */
export function renderFeaturesBlock(f: PositionFeatures): string {
  const sections: Array<[string, string[]]> = [
    ['Material', f.material.imbalance !== 'none' ? [`imbalance: ${f.material.imbalance}`] : []],
    ['Pawns', pawnLines(f.pawns)],
    ['King safety', bothSides(f.king_safety, kingLine)],
    [
      'Center',
      [
        f.center_space.locked_center ? 'locked center' : null,
        f.center_space.space.white - f.center_space.space.black >= 4 ? 'white space advantage' : null,
        f.center_space.space.black - f.center_space.space.white >= 4 ? 'black space advantage' : null,
      ].filter((s): s is string => s !== null),
    ],
    ['Files', filesLines(f.files_diagonals)],
    ['Activity', activityLines(f.activity)],
    // Prefer validated 4c.1 motifs; fall back to raw geometry on old sidecars.
    ['Tactics', f.motifs ? motifLines(f.motifs) : geometryLines(f.tactics_geometry)],
  ];

  const bishopPair = (['white', 'black'] as const).filter((s) => f.material.bishop_pair[s]);
  if (bishopPair.length === 1) sections[0]![1].push(`${bishopPair[0]} has the bishop pair`);

  return sections
    .filter(([, lines]) => lines.length > 0)
    .map(([title, lines]) => `${title}: ${lines.join('; ')}`)
    .join('\n');
}
