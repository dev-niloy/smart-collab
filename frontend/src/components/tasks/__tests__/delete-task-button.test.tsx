import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { pushSpy, deleteTaskSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  deleteTaskSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: vi.fn() }),
}));

vi.mock('@/lib/auth', () => ({ me: vi.fn(), logout: vi.fn() }));

vi.mock('@/lib/tasks', () => ({
  deleteTask: (...a: unknown[]) => deleteTaskSpy(...a),
  listTasks: vi.fn(),
  listTasksForProject: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
}));

import { DeleteTaskButton } from '../delete-task-button';

const renderBtn = () =>
  render(
    <Providers>
      <DeleteTaskButton projectId="p-1" taskId="t-1" taskTitle="Launch site" />
    </Providers>,
  );

describe('DeleteTaskButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens dialog and shows confirm copy', async () => {
    const user = userEvent.setup();
    renderBtn();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByText(/delete task\?/i)).toBeInTheDocument());
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument();
  });

  it('confirm: calls deleteTask + router.push tasks list', async () => {
    deleteTaskSpy.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBtn();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByText(/delete task\?/i)).toBeInTheDocument());
    const confirm = screen.getAllByRole('button', { name: /^delete$/i }).at(-1)!;
    await user.click(confirm);
    await waitFor(() => expect(deleteTaskSpy).toHaveBeenCalledWith('t-1'));
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/projects/p-1/tasks'));
  });

  it('cancel: closes without calling deleteTask', async () => {
    const user = userEvent.setup();
    renderBtn();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByText(/delete task\?/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText(/delete task\?/i)).not.toBeInTheDocument());
    expect(deleteTaskSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
