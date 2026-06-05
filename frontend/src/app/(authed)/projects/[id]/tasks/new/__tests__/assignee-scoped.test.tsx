import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { meSpy, pushSpy, replaceSpy } = vi.hoisted(() => ({
  meSpy: vi.fn(),
  pushSpy: vi.fn(),
  replaceSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'p-1' }),
}));

vi.mock('@/lib/auth', () => ({
  me: () => meSpy(),
  logout: vi.fn(),
}));

const { listAssignableSpy, listUsersSpy, createSpy } = vi.hoisted(() => ({
  listAssignableSpy: vi.fn(),
  listUsersSpy: vi.fn(),
  createSpy: vi.fn(),
}));

vi.mock('@/lib/project-members', () => ({
  listAssignableMembers: () => listAssignableSpy(),
  listProjectMembers: vi.fn(),
  addProjectMember: vi.fn(),
  updateProjectMemberRole: vi.fn(),
  removeProjectMember: vi.fn(),
}));

vi.mock('@/lib/users', () => ({
  listUsers: () => listUsersSpy(),
}));

vi.mock('@/lib/tasks', () => ({
  listTasks: vi.fn(),
  listTasksForProject: vi.fn(),
  getTask: vi.fn(),
  createTask: (...a: unknown[]) => createSpy(...a),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

import NewTaskPage from '../page';

describe('E20: new task form scoped assignee picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meSpy.mockResolvedValue({
      user: { id: 'u-me', email: 'me@x.co', name: 'Me', role: 'admin' },
    });
  });

  it('uses listAssignableMembers for assignee dropdown, not listUsers', async () => {
    listAssignableSpy.mockResolvedValue([
      { id: 'u-alice', email: 'alice@x.co', name: 'Alice', role: 'team_member', projectRole: 'member' },
    ]);
    render(
      <Providers>
        <NewTaskPage />
      </Providers>,
    );
    await waitFor(() => expect(listAssignableSpy).toHaveBeenCalled());
    expect(listUsersSpy).not.toHaveBeenCalled();
  });

  it('renders only project members in assignee dropdown', async () => {
    listAssignableSpy.mockResolvedValue([
      { id: 'u-alice', email: 'alice@x.co', name: 'Alice', role: 'team_member', projectRole: 'member' },
    ]);
    render(
      <Providers>
        <NewTaskPage />
      </Providers>,
    );
    const user = userEvent.setup();
    await waitFor(() => expect(listAssignableSpy).toHaveBeenCalled());
    await user.click(screen.getByLabelText(/assignee/i));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: /alice/i })).toBeTruthy(),
    );
  });
});
