/**
 * In-memory RepertoireRepository — exclusively for tests.
 */

import { DEFAULT_PICK, type RepertoirePick } from '../../types/repertoire';
import type { RepertoireRepository } from './RepertoireRepository';

export class InMemoryRepertoireRepository implements RepertoireRepository {
  private pick: RepertoirePick | null = null;

  resetDbCache(): void {
    /* no-op */
  }

  async getPick(): Promise<RepertoirePick> {
    return this.pick === null ? { ...DEFAULT_PICK } : { ...this.pick };
  }

  async savePick(pick: RepertoirePick): Promise<void> {
    this.pick = { ...pick };
  }

  async resetPick(): Promise<void> {
    this.pick = null;
  }
}
