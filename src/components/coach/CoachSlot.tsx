/**
 * CoachSlot — Phase 3 placeholder for the Phase 4 Coach on the OOB viewer
 * (design §7). The viewer passes the full OOB context payload now so Phase 4
 * only replaces this file's body — no props re-plumbing on the surface.
 */

export interface CoachSlotProps {
  gameId: string;
  plyIndex: number;
  fenAtOOB: string;
  playedSAN: string;
  expectedSANs: string[];
  lineId: string | null;
}

export function CoachSlot(_props: CoachSlotProps): null {
  return null; // Phase 4 replaces this with the "Ask Coach" surface
}
