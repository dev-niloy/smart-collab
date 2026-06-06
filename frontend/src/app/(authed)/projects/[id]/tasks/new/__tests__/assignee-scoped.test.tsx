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

  it('renders only project members in multi-assignee picker', async () => {
    listAssignableSpy.mockResolvedValue([
      { id: 'u-alice', email: 'alice@x.co', name: 'Alice', role: 'team_member', projectRole: 'member' },
    ]);
    render(
      <Providers>
        <NewTaskPage />
      </Providers>,
    );
    await waitFor(() => expect(listAssignableSpy).toHaveBeenCalled());
    // Checkbox list, one per project member
    expect(await screen.findByLabelText('Alice')).toBeInTheDocument();
  });

  it('checking a member adds them to assigneeIds; submit sends array', async () => {
    listAssignableSpy.mockResolvedValue([
      { id: 'u-alice', email: 'alice@x.co', name: 'Alice', role: 'team_member', projectRole: 'member' },
      { id: 'u-bob', email: 'bob@x.co', name: 'Bob', role: 'team_member', projectRole: 'member' },
    ]);
    createSpy.mockResolvedValue({
      id: 't-1',
      projectId: 'p-1',
      title: 'Two',
      description: null,
      status: 'todo',
      priority: 'medium',
      dueDate: '2030-06-01T00:00:00.000Z',
      createdBy: 'u-me',
      creator: { id: 'u-me', email: 'me@x.co', name: 'Me', role: 'admin' },
      assignees: [],
      deletedAt: null,
      createdAt: '',
      updatedAt: '',
    });
    const user = userEvent.setup();
    render(
      <Providers>
        <NewTaskPage />
      </Providers>,
    );
    await waitFor(() => expect(listAssignableSpy).toHaveBeenCalled());
    await user.type(screen.getByLabelText(/title/i), 'Two');
    await user.type(screen.getByLabelText(/due date/i), '2030-06-01');
    await user.click(await screen.findByLabelText('Alice'));
    await user.click(await screen.findByLabelText('Bob'));
    await user.click(screen.getByRole('button', { name: /create task/i }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    const arg = createSpy.mock.calls[0][0];
    expect(arg.assigneeIds).toEqual(expect.arrayContaining(['u-alice', 'u-bob']));
    expect(arg.assigneeIds).toHaveLength(2);
  });
});
