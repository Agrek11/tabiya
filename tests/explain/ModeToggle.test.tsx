/**
 * <ModeToggle> + DrillPage integration tests — R1 visibility and per-line
 * persistence. Pure component coverage only here; DrillPage routing is
 * exercised in drill-page.test.tsx via baseline regression.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { ModeToggle } from '../../src/ui/ModeToggle';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('<ModeToggle>', () => {
  it('renders both options with correct selected state', () => {
    renderWithProviders(<ModeToggle value="drill" onChange={() => undefined} />);
    const drill = screen.getByTestId('mode-toggle-drill');
    const explain = screen.getByTestId('mode-toggle-explain');
    expect(drill.getAttribute('aria-selected')).toBe('true');
    expect(explain.getAttribute('aria-selected')).toBe('false');
  });

  it('clicking the inactive option fires onChange', () => {
    const onChange = vi.fn();
    renderWithProviders(<ModeToggle value="drill" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('mode-toggle-explain'));
    expect(onChange).toHaveBeenCalledWith('explain');
  });

  it('ArrowRight cycles to the next option', () => {
    const onChange = vi.fn();
    renderWithProviders(<ModeToggle value="drill" onChange={onChange} />);
    const tablist = screen.getByTestId('mode-toggle');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('explain');
  });

  it('ArrowLeft cycles backward (wraps)', () => {
    const onChange = vi.fn();
    renderWithProviders(<ModeToggle value="drill" onChange={onChange} />);
    const tablist = screen.getByTestId('mode-toggle');
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('explain');
  });

  it('disabled state cannot be activated by keyboard', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <ModeToggle value="drill" onChange={onChange} disabled />,
    );
    const tablist = screen.getByTestId('mode-toggle');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
