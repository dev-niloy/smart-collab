import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Providers } from '../providers';
import { ThemeToggle } from '../theme-toggle';

describe('Providers', () => {
  it('renders children inside ThemeProvider + QueryClientProvider', () => {
    render(
      <Providers>
        <div data-testid="child">hi</div>
      </Providers>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('hi');
  });

  it('ThemeToggle renders a Theme button trigger', () => {
    render(
      <Providers>
        <ThemeToggle />
      </Providers>,
    );
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument();
  });
});
