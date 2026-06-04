import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpcomingList } from '../UpcomingList';

describe('UpcomingList', () => {
  it('renders tasks + projects rows w/ links', () => {
    render(
      <UpcomingList
        data={{
          tasks: [
            { id: 't-1', title: 'Soon task', dueDate: '2030-06-04T00:00:00.000Z', projectId: 'p-1', priority: 'high', status: 'todo' },
          ],
          projects: [{ id: 'p-1', name: 'Soon project', deadline: '2030-06-04T00:00:00.000Z' }],
        }}
      />,
    );
    expect(screen.getByText('Soon task').closest('a')).toHaveAttribute('href', '/projects/p-1/tasks/t-1');
    expect(screen.getByText('Soon project').closest('a')).toHaveAttribute('href', '/projects/p-1');
  });

  it('shows empty copy when no items', () => {
    render(<UpcomingList data={{ tasks: [], projects: [] }} days={7} />);
    expect(screen.getByText(/nothing in the next 7 days/i)).toBeTruthy();
  });

  it('renders loading skeletons', () => {
    const { container } = render(<UpcomingList data={undefined} loading />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});
