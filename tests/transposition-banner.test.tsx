/**
 * TranspositionBanner (Phase 2b R8) — presentational tests.
 *
 * Covers:
 *   - 0 matches → null (caller's hook is the gating layer; component
 *     defends by also returning null on empty).
 *   - matches render as clickable chips with displayName.
 *   - truncatedCount > 0 → "+N more" appears.
 *   - dismiss → null after click.
 *   - chip click calls onJump with the correct lineId (R8.4).
 */

import { cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from './test-utils';
import { TranspositionBanner } from '../src/components/drill/TranspositionBanner';

afterEach(() => {
  cleanup();
});

describe('TranspositionBanner', () => {
  it('returns null when matches is empty', () => {
    const { container } = renderWithProviders(
      <TranspositionBanner matches={[]} truncatedCount={0} onJump={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one chip per match', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <TranspositionBanner
        matches={[
          { lineId: 'line-a', displayName: 'Line A' },
          { lineId: 'line-b', displayName: 'Line B' },
        ]}
        truncatedCount={0}
        onJump={() => {}}
      />
    );
    expect(getByTestId('transposition-chip-line-a').textContent).toContain(
      'Line A'
    );
    expect(getByTestId('transposition-chip-line-b').textContent).toContain(
      'Line B'
    );
    expect(queryByTestId('transposition-more')).toBeNull();
  });

  it('shows +N more when truncatedCount > 0 (R8.3)', () => {
    const { getByTestId } = renderWithProviders(
      <TranspositionBanner
        matches={[
          { lineId: 'line-a', displayName: 'Line A' },
          { lineId: 'line-b', displayName: 'Line B' },
          { lineId: 'line-c', displayName: 'Line C' },
        ]}
        truncatedCount={2}
        onJump={() => {}}
      />
    );
    expect(getByTestId('transposition-more').textContent).toBe('+2 more');
  });

  it('chip click calls onJump with lineId (R8.4)', () => {
    const onJump = vi.fn();
    const { getByTestId } = renderWithProviders(
      <TranspositionBanner
        matches={[{ lineId: 'line-a', displayName: 'Line A' }]}
        truncatedCount={0}
        onJump={onJump}
      />
    );
    fireEvent.click(getByTestId('transposition-chip-line-a'));
    expect(onJump).toHaveBeenCalledOnce();
    expect(onJump).toHaveBeenCalledWith('line-a');
  });

  it('dismiss button hides the banner for the session (R8.5)', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <TranspositionBanner
        matches={[{ lineId: 'line-a', displayName: 'Line A' }]}
        truncatedCount={0}
        onJump={() => {}}
      />
    );
    expect(queryByTestId('transposition-banner')).not.toBeNull();
    fireEvent.click(getByTestId('transposition-dismiss'));
    expect(queryByTestId('transposition-banner')).toBeNull();
  });
});
