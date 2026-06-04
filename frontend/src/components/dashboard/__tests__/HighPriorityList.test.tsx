import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HighPriorityList } from '../HighPriorityList';

describe('HighPriorityList', () => {
  it('renders rows w/ priority badge + assignee + due date', () => {
    render(
      <HighPriorityList
        data={[
          {
            id: 't-1',
            title: 'Critical',
            projectId: 'p-1',
            dueDate: '2030-06-04T00:00:00.000Z',
            status: 'todo',
            assignee: { id: 'u-1', email: 'a@x.co', name: 'Alice' },
          },
        ]}
      />,
    );
    expect(screen.getByText('Critical').closest('a')).toHaveAttribute('href', '/projects/p-1/tasks/t-1');
    expect(screen.getByText('high')).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
  });

  it('shows Unassigned when no assignee', () => {
    render(
      <HighPriorityList
        data={[
          { id: 't-1', title: 'Lone', projectId: 'p-1', dueDate: '2030-06-04T00:00:00.000Z', status: 'todo', assignee: null },
        ]}
      />,
    );
    expect(screen.getByText(/unassigned/i)).toBeTruthy();
  });

  it('shows empty copy when no items', () => {
    render(<HighPriorityList data={[]} />);
    expect(screen.getByText(/no open high-priority tasks/i)).toBeTruthy();
  });
});
