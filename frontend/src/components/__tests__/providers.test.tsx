import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Providers } from '../providers';

describe('Providers', () => {
  it('renders children inside ThemeProvider + QueryClientProvider', () => {
    render(
      <Providers>
        <div data-testid="child">hi</div>
      </Providers>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('hi');
  });
});
