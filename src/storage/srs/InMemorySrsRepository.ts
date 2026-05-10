/**
 * In-memory SrsRepository — used by tests, Storybook (future), and any
 * future ephemeral session mode.
 */

import { nextSrsState } from './scheduler';
import type { DrillResult, SrsRepository, SrsState } from '../types';

export class InMemorySrsRepository implements SrsRepository {
  private states = new Map<string, SrsState>();

  async getState(lineId: string): Promise<SrsState | null> {
    return this.states.get(lineId) ?? null;
  }

  async listAllStates(): Promise<SrsState[]> {
    return Array.from(this.states.values());
  }

  async recordDrillResult(lineId: string, result: DrillResult): Promise<SrsState> {
    const prev = this.states.get(lineId) ?? null;
    const computed = nextSrsState(prev, result);
    const next: SrsState = { ...computed, line_id: lineId };
    this.states.set(lineId, next);
    return next;
  }

  async resetState(lineId: string): Promise<void> {
    this.states.delete(lineId);
  }

  async resetAll(): Promise<void> {
    this.states.clear();
  }
}
