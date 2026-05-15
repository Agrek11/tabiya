/**
 * <ExplainRail> + <TruncatedText> tests — R7 truncation and R3 control wiring.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { ExplainRail } from '../../src/ui/explain/ExplainRail';
import { TruncatedText } from '../../src/ui/explain/TruncatedText';
import type { ExplainBlock } from '../../src/storage/types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const BLOCK_SHORT: ExplainBlock = { rationale: 'Develop a piece.' };
const BLOCK_LONG: ExplainBlock = {
  rationale: 'x'.repeat(400),
};
const BLOCK_WITH_THREATS: ExplainBlock = {
  rationale: 'Bishop attacks f7.',
  threats: 'If ...Nxe4 then Re1 wins material.',
};

describe('<TruncatedText>', () => {
  it('renders text under limit as-is, no toggle', () => {
    renderWithProviders(<TruncatedText text="short" limit={280} />);
    expect(screen.getByText('short')).toBeTruthy();
    expect(screen.queryByText(/show more/i)).toBeNull();
  });

  it('exactly at limit (280) — no toggle', () => {
    const t = 'a'.repeat(280);
    renderWithProviders(<TruncatedText text={t} limit={280} />);
    expect(screen.queryByText(/show more/i)).toBeNull();
  });

  it('over limit (281) — shows truncated + toggle', () => {
    const t = 'b'.repeat(281);
    renderWithProviders(<TruncatedText text={t} limit={280} />);
    const button = screen.getByText(/show more/i);
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(screen.getByText(/show less/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/show less/i));
    expect(screen.getByText(/show more/i)).toBeTruthy();
  });
});

describe('<ExplainRail>', () => {
  function setup(overrides: Partial<React.ComponentProps<typeof ExplainRail>> = {}) {
    const props = {
      block: BLOCK_SHORT,
      ply: 0,
      totalPlies: 4,
      paused: false,
      canPrev: true,
      canNext: true,
      onPrev: vi.fn(),
      onNext: vi.fn(),
      onTogglePause: vi.fn(),
      onRestart: vi.fn(),
      onSkip: vi.fn(),
      ttsEnabledGlobal: false,
      ttsMutedForLine: false,
      onToggleLineMute: vi.fn(),
      ...overrides,
    };
    renderWithProviders(<ExplainRail {...props} />);
    return props;
  }

  it('renders the rationale text', () => {
    setup();
    expect(screen.getByText('Develop a piece.')).toBeTruthy();
  });

  it('Prev button calls onPrev', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /previous ply/i }));
    expect(props.onPrev).toHaveBeenCalledTimes(1);
  });

  it('Pause button shows "Resume" label when paused', () => {
    setup({ paused: true });
    expect(screen.getByRole('button', { name: /resume autoplay/i })).toBeTruthy();
  });

  it('Next button is disabled when canNext=false', () => {
    setup({ canNext: false });
    const btn = screen.getByRole('button', { name: /next ply/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Skip button calls onSkip', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /skip to drill/i }));
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it('threats section renders when threats present', () => {
    setup({ block: BLOCK_WITH_THREATS });
    expect(screen.getByText(/threats/i)).toBeTruthy();
    expect(screen.getByText(/If \.\.\.Nxe4/)).toBeTruthy();
  });

  it('threats section hidden when threats absent', () => {
    setup({ block: BLOCK_SHORT });
    expect(screen.queryByTestId('explain-threats')).toBeNull();
  });

  it('long rationale shows "show more" toggle', () => {
    setup({ block: BLOCK_LONG });
    expect(screen.getByRole('button', { name: /show more/i })).toBeTruthy();
  });

  it('speaker icon hidden when ttsEnabledGlobal=false', () => {
    setup({ ttsEnabledGlobal: false });
    expect(screen.queryByRole('button', { name: /speech for this line/i })).toBeNull();
  });

  it('speaker icon shows when ttsEnabledGlobal=true', () => {
    setup({ ttsEnabledGlobal: true, ttsMutedForLine: false });
    expect(screen.getByRole('button', { name: /Mute speech for this line/i })).toBeTruthy();
  });
});
