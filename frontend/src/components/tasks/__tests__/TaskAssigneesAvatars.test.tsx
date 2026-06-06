import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TaskAssigneesAvatars } from '../TaskAssigneesAvatars';
import type { TaskUser } from '@/lib/schemas/task';

const mk = (id: string, name: string): TaskUser => ({
  id,
  email: `${id}@t.local`,
  name,
  role: 'team_member',
});

describe('TaskAssigneesAvatars', () => {
  it('renders Unassigned pill when zero users', () => {
    render(<TaskAssigneesAvatars users={[]} />);
    expect(screen.getByTestId('task-unassigned')).toHaveTextContent('Unassigned');
  });

  it('renders 1-3 avatars without overflow badge', () => {
    render(
      <TaskAssigneesAvatars
        users={[mk('1', 'Alice A'), mk('2', 'Bob B'), mk('3', 'Carol C')]}
      />,
    );
    const group = screen.getByTestId('task-assignees');
    expect(group).toBeInTheDocument();
    expect(screen.getByLabelText('Alice A')).toBeInTheDocument();
    expect(screen.getByLabelText('Bob B')).toBeInTheDocument();
    expect(screen.getByLabelText('Carol C')).toBeInTheDocument();
    expect(screen.queryByLabelText(/more assignees/)).not.toBeInTheDocument();
  });

  it('renders 3 avatars + +N badge when >3', () => {
    render(
      <TaskAssigneesAvatars
        users={[
          mk('1', 'A'),
          mk('2', 'B'),
          mk('3', 'C'),
          mk('4', 'D'),
          mk('5', 'E'),
        ]}
      />,
    );
    expect(screen.getByLabelText('+2 more assignees')).toBeInTheDocument();
    // Visible names — first 3
    expect(screen.getByLabelText('A')).toBeInTheDocument();
    expect(screen.getByLabelText('B')).toBeInTheDocument();
    expect(screen.getByLabelText('C')).toBeInTheDocument();
    // Hidden behind overflow
    expect(screen.queryByLabelText('D')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('E')).not.toBeInTheDocument();
  });

  it('accepts assignees prop (TaskAssigneeRel[]) and projects user', () => {
    render(
      <TaskAssigneesAvatars
        assignees={[
          {
            userId: '1',
            addedById: 'x',
            addedAt: '2026-01-01T00:00:00Z',
            user: mk('1', 'Diana D'),
          },
        ]}
      />,
    );
    expect(screen.getByLabelText('Diana D')).toBeInTheDocument();
  });
});
