/**
 * Shared render helpers — wrap test components in the providers they expect
 * (BrowserRouter for react-router-dom, ThemeProvider for theme tokens).
 */

import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../src/theme/ThemeContext';
import { BoardThemeProvider } from '../src/theme/BoardThemeContext';
import { PieceSetProvider } from '../src/theme/PieceSetContext';

type ProviderOptions = RenderOptions & {
  route?: string;
};

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', ...rest }: ProviderOptions = {}
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <ThemeProvider>
        <BoardThemeProvider>
          <PieceSetProvider>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </PieceSetProvider>
        </BoardThemeProvider>
      </ThemeProvider>
    ),
    ...rest,
  });
}
