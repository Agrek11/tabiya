/**
 * RepertoireRepository — Article 5 seam for the user's persisted pick.
 *
 * Single-row store keyed `'current'`. Reads return the persisted pick or a
 * documented default (`{ presetId: 'off', additions: [], removals: [] }`) for
 * brand-new users (R5.9).
 */

import type { RepertoirePick } from '../../types/repertoire';

export interface RepertoireRepository {
  /** Returns the saved pick, or DEFAULT_PICK if none exists. Never rejects on
   *  missing-row; only on IDB errors. */
  getPick(): Promise<RepertoirePick>;
  savePick(pick: RepertoirePick): Promise<void>;
  resetPick(): Promise<void>;
  resetDbCache(): void;
}
