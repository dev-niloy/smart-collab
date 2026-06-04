import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 300 }}>{children}</div>
    ),
  };
});

import { ProductivityLine } from '../ProductivityLine';

describe('ProductivityLine', () => {
  it('renders LineChart w/ N data points and title showing days count', () => {
    const data = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      completed: i,
    }));
    render(<ProductivityLine data={data} />);
    expect(screen.getByTestId('productivity-line')).toBeTruthy();
    expect(screen.getByText(/Productivity \(7 days\)/i)).toBeTruthy();
  });

  it('shows empty placeholder when all zeros', () => {
    const data = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-06-0${i + 1}`,
      completed: 0,
    }));
    render(<ProductivityLine data={data} />);
    expect(screen.getByText(/no completed tasks/i)).toBeTruthy();
  });

  it('renders loading skeleton', () => {
    const { container } = render(<ProductivityLine data={undefined} loading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders error alert', () => {
    render(<ProductivityLine data={undefined} error />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
