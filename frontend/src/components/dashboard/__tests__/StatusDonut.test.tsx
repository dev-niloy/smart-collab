import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock ResponsiveContainer to provide fixed dims for jsdom rendering
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 300 }}>{children}</div>
    ),
  };
});

import { StatusDonut } from '../StatusDonut';

describe('StatusDonut', () => {
  it('renders donut w/ data', () => {
    render(<StatusDonut data={{ todo: 2, in_progress: 1, completed: 3 }} />);
    expect(screen.getByTestId('status-donut')).toBeTruthy();
    expect(screen.getByText('Tasks by status')).toBeTruthy();
  });

  it('shows empty placeholder when all zeros', () => {
    render(<StatusDonut data={{ todo: 0, in_progress: 0, completed: 0 }} />);
    expect(screen.getByText(/no tasks yet/i)).toBeTruthy();
  });

  it('renders loading skeleton', () => {
    const { container } = render(<StatusDonut data={undefined} loading />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });
});
