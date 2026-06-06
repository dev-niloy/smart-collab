import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { meSpy, pushSpy, createTaskSpy, listUsersSpy } = vi.hoisted(() => ({
  meSpy: vi.fn(),
  pushSpy: vi.fn(),
  createTaskSpy: vi.fn(),
  listUsersSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: vi.fn() }),
  useParams: () => ({ id: 'p-1' }),
}));

vi.mock('@/lib/auth', () => ({
  me: () => meSpy(),
  logout: vi.fn(),
}));

vi.mock('@/lib/tasks', () => ({
  createTask: (...a: unknown[]) => createTaskSpy(...a),
  listTasks: vi.fn(),
  listTasksForProject: vi.fn(),
  getTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock('@/lib/users', () => ({
  listUsers: () => listUsersSpy(),
}));

import NewTaskPage from '../page';

const setUser = (role: 'admin' | 'project_manager' | 'team_member') => {
  meSpy.mockResolvedValue({
    user: { id: 'u', email: 'me@x.y', name: 'Me', role, createdAt: '', updatedAt: '' },
  });
};

const renderPage = () =>
  render(
    <Providers>
      <NewTaskPage />
    </Providers>,
  );

describe('NewTaskPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUsersSpy.mockResolvedValue([]);
  });

  it('member submits valid form, calls createTask with projectId, pushes detail', async () => {
    setUser('team_member');
    createTaskSpy.mockResolvedValue({
      id: 't-99',
      projectId: 'p-1',
      title: 'X',
      description: null,
      status: 'todo',
      priority: 'medium',
      dueDate: '2030-06-01T00:00:00.000Z',
      assignedTo: null,
      createdBy: 'u',
      creator: { id: 'u', email: 'me@x.y', name: 'Me', role: 'team_member' },
      assignee: null,
      createdAt: '',
      updatedAt: '',
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText(/new task/i)).toBeInTheDocument());
    await user.type(screen.getByLabelText(/title/i), 'Ship feature');
    await user.type(screen.getByLabelText(/due date/i), '2030-06-01');
    await user.click(screen.getByRole('button', { name: /create task/i }));
    await waitFor(() => expect(createTaskSpy).toHaveBeenCalledTimes(1));
    const arg = createTaskSpy.mock.calls[0][0];
    expect(arg.projectId).toBe('p-1');
    expect(arg.title).toBe('Ship feature');
    expect(arg.dueDate).toBeInstanceOf(Date);
    expect(arg.assigneeIds).toEqual([]);
    expect(arg.status).toBe('todo');
    expect(arg.priority).toBe('medium');
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/projects/p-1/tasks/t-99'));
  });

  it('shows inline error when title empty', async () => {
    setUser('admin');
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument());
    await user.type(screen.getByLabelText(/due date/i), '2030-06-01');
    await user.click(screen.getByRole('button', { name: /create task/i }));
    await waitFor(() => expect(screen.getByText(/title is required/i)).toBeInTheDocument());
    expect(createTaskSpy).not.toHaveBeenCalled();
  });

  it('shows inline error when due date empty', async () => {
    setUser('admin');
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument());
    await user.type(screen.getByLabelText(/title/i), 'X');
    await user.click(screen.getByRole('button', { name: /create task/i }));
    await waitFor(() => expect(screen.getByText(/due date is required/i)).toBeInTheDocument());
    expect(createTaskSpy).not.toHaveBeenCalled();
  });
});
