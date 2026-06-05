import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ForbiddenPage from '../page';

describe('ForbiddenPage', () => {
  it('renders 403 message + back link', () => {
    render(<ForbiddenPage />);
    expect(screen.getByText(/403/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});
