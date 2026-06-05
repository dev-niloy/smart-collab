import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardPanel } from '../DashboardPanel';

describe('DashboardPanel', () => {
  it('renders Dashboard header + 2 shortcut links', () => {
    render(<DashboardPanel />);
    expect(screen.getByRole('heading', { level: 2, name: /dashboard/i })).toBeInTheDocument();

    const myTasks = screen.getByRole('link', { name: /my open tasks/i });
    expect(myTasks).toHaveAttribute('href', '/dashboard#my-open-tasks');

    const deadlines = screen.getByRole('link', { name: /today's deadlines/i });
    expect(deadlines).toHaveAttribute('href', '/dashboard#upcoming-deadlines');
  });
});
