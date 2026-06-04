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

import { PriorityBar } from '../PriorityBar';

describe('PriorityBar', () => {
  it('renders bar chart w/ data', () => {
    render(<PriorityBar data={{ low: 1, medium: 2, high: 3 }} />);
    expect(screen.getByTestId('priority-bar')).toBeTruthy();
    expect(screen.getByText('Tasks by priority')).toBeTruthy();
  });

  it('shows empty placeholder when all zeros', () => {
    render(<PriorityBar data={{ low: 0, medium: 0, high: 0 }} />);
    expect(screen.getByText(/no tasks yet/i)).toBeTruthy();
  });

  it('renders error alert', () => {
    render(<PriorityBar data={undefined} error />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
