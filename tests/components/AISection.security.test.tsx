/**
 * AISection key-leak regression — Task 11.7 (R6.6, Article 11).
 *
 * The API key must never appear in the rendered DOM serialization (password
 * input renders masked, value held in JS state) and must never reach any
 * console method — including during a full Test-connection flow.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { AI_STORAGE_KEYS } from '../../src/coach/aiSettings';
import type { LLMClient } from '../../src/coach/LLMClient';

const SECRET = 'sk-ant-secret123';

const fakeClient: LLMClient = {
  providerName: 'anthropic',
  modelName: 'claude-haiku-4-5-20251001',
  available: async () => true,
  complete: async () => ({ text: 'pong', modelName: 'claude-haiku-4-5-20251001' }),
};

vi.mock('../../src/coach/container', () => ({
  getLLMClient: () => fakeClient,
  _clearClientCache: () => {},
}));

import { AISection } from '../../src/components/settings/AISection';

let spies: Array<ReturnType<typeof vi.spyOn>>;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(AI_STORAGE_KEYS.location, 'cloud');
  localStorage.setItem(AI_STORAGE_KEYS.provider, 'anthropic');
  localStorage.setItem(AI_STORAGE_KEYS.apiKey, SECRET);
  spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

function assertNoConsoleLeak(): void {
  for (const spy of spies) {
    for (const call of spy.mock.calls) {
      const flat = call.map((a) => String(a)).join(' ');
      expect(flat).not.toContain(SECRET);
    }
  }
}

describe('AISection — API key never leaks', () => {
  it('key string is absent from the rendered DOM serialization', () => {
    const { container } = renderWithProviders(<AISection />);

    expect(container.innerHTML).not.toContain(SECRET);

    // The input is password-typed; its DOM attribute surface stays masked.
    const input = screen.getByTestId('ai-api-key') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.getAttribute('value')).not.toBe(SECRET);
  });

  it('Test-connection flow emits the key to no console method', async () => {
    renderWithProviders(<AISection />);

    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => expect(screen.getByText(/Connected to/)).toBeTruthy());

    assertNoConsoleLeak();
  });

  it('[Clear key] wipes localStorage', () => {
    renderWithProviders(<AISection />);

    fireEvent.click(screen.getByText('Clear key'));
    expect(localStorage.getItem(AI_STORAGE_KEYS.apiKey)).toBeNull();
    assertNoConsoleLeak();
  });
});
