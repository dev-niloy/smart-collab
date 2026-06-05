import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { meSpy, pushSpy, getTaskSpy, updateTaskSpy, listUsersSpy } = vi.hoisted(() => ({
  meSpy: vi.fn(),
  pushSpy: vi.fn(),
  getTaskSpy: vi.fn(),
  updateTaskSpy: vi.fn(),
  listUsersSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: vi.fn() }),
  useParams: () => ({ id: 'p-1', taskId: 't-1' }),
}));

vi.mock('@/lib/auth', () => ({ me: () => meSpy(), logout: vi.fn() }));

vi.mock('@/lib/tasks', () => ({
  getTask: (...a: unknown[]) => getTaskSpy(...a),
  updateTask: (...a: unknown[]) => updateTaskSpy(...a),
  listTasks: vi.fn(),
  listTasksForProject: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock('@/lib/users', () => ({
  listUsers: () => listUsersSpy(),
}));

import EditTaskPage from '../page';

const setUser = (role: 'admin' | 'project_manager' | 'team_member') => {
  meSpy.mockResolvedValue({
    user: { id: 'u', email: 'me@x.y', name: 'Me', role, createdAt: '', updatedAt: '' },
  });
};

const sampleTask = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 't-1',
  projectId: 'p-1',
  title: 'Launch',
  description: 'Old desc',
  status: 'todo' as const,
  priority: 'medium' as const,
  dueDate: '2030-06-01T00:00:00.000Z',
  assignedTo: null,
  createdBy: 'u',
  creator: { id: 'u', email: 'me@x.y', name: 'Me', role: 'admin' as const },
  assignee: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const renderPage = () =>
  render(
    <Providers>
      <EditTaskPage />
    </Providers>,
  );

describe('EditTaskPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listUsersSpy.mockResolvedValue([]);
  });

  it('admin: prefills, submits update, pushes detail', async () => {
    setUser('admin');
    getTaskSpy.mockResolvedValue(sampleTask());
    updateTaskSpy.mockResolvedValue(sampleTask({ title: 'Launch v2' }));
    const user = userEvent.setup();
    renderPage();

    const titleInput = (await waitFor(() => screen.getByLabelText(/title/i))) as HTMLInputElement;
    await waitFor(() => expect(titleInput.value).toBe('Launch'));
    await user.clear(titleInput);
    await user.type(titleInput, 'Launch v2');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateTaskSpy).toHaveBeenCalledTimes(1));
    const [calledId, payload] = updateTaskSpy.mock.calls[0];
    expect(calledId).toBe('t-1');
    expect(payload.title).toBe('Launch v2');
    expect(payload.dueDate).toBeInstanceOf(Date);
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/projects/p-1/tasks/t-1'));
  });

  it('surfaces API error as toast (server-enforced ownership)', async () => {
    setUser('team_member');
    getTaskSpy.mockResolvedValue(sampleTask());
    const err = Object.assign(new Error('Insufficient permissions for this task'), {
      name: 'ApiError',
      status: 403,
      code: 'FORBIDDEN_OWNERSHIP',
    });
    Object.setPrototypeOf(err, (await import('@/lib/api')).ApiError.prototype);
    updateTaskSpy.mockRejectedValue(err);

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Launch'));
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(updateTaskSpy).toHaveBeenCalled());
    // Push must NOT happen on error
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
