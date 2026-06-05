import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { updateTaskSpy, toastErrorSpy } = vi.hoisted(() => ({
  updateTaskSpy: vi.fn(),
  toastErrorSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/auth', () => ({ me: vi.fn(), logout: vi.fn() }));

vi.mock('@/lib/tasks', () => ({
  updateTask: (...a: unknown[]) => updateTaskSpy(...a),
  listTasks: vi.fn(),
  listTasksForProject: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...a: unknown[]) => toastErrorSpy(...a),
    success: vi.fn(),
  },
  Toaster: () => null,
}));

import { InlineStatusSelect } from '../inline-status-select';

const sampleTask = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 't-1',
  projectId: 'p-1',
  title: 'Ship docs',
  description: null,
  status: 'todo' as const,
  priority: 'medium' as const,
  dueDate: '2030-01-01T00:00:00.000Z',
  assignedTo: null,
  createdBy: 'u-1',
  creator: { id: 'u-1', email: 'a@x.y', name: 'Alice', role: 'admin' as const },
  assignee: null,
  deletedAt: null,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const renderSelect = (task = sampleTask()) =>
  render(
    <Providers>
      <InlineStatusSelect task={task} />
    </Providers>,
  );

describe('InlineStatusSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders current status', () => {
    renderSelect();
    const trigger = screen.getByLabelText(/status for ship docs/i);
    expect(trigger).toBeInTheDocument();
  });

  it('changing status fires updateTask with {status}', async () => {
    updateTaskSpy.mockResolvedValue(sampleTask({ status: 'in_progress' }));
    const user = userEvent.setup();
    renderSelect();
    await user.click(screen.getByLabelText(/status for ship docs/i));
    const opt = await screen.findByRole('option', { name: /in progress/i });
    await user.click(opt);
    await waitFor(() => expect(updateTaskSpy).toHaveBeenCalled());
    expect(updateTaskSpy.mock.calls[0][0]).toBe('t-1');
    expect(updateTaskSpy.mock.calls[0][1]).toEqual({ status: 'in_progress' });
  });

  it('error: shows toast prefixed with task title', async () => {
    const apiErr = await import('@/lib/api');
    const err = Object.assign(new apiErr.ApiError({
      status: 422,
      code: 'REASSIGN_COMPLETED',
      message: 'Cannot reassign a completed task.',
    }));
    updateTaskSpy.mockRejectedValue(err);
    const user = userEvent.setup();
    renderSelect();
    await user.click(screen.getByLabelText(/status for ship docs/i));
    const opt = await screen.findByRole('option', { name: /completed/i });
    await user.click(opt);
    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalled());
    const msg = String(toastErrorSpy.mock.calls[0][0]);
    expect(msg).toContain('"Ship docs"');
    expect(msg).toContain('Cannot reassign a completed task.');
  });

  it('skips mutation when selecting same value (noop)', async () => {
    const user = userEvent.setup();
    renderSelect();
    await user.click(screen.getByLabelText(/status for ship docs/i));
    const opt = await screen.findByRole('option', { name: /todo/i });
    await user.click(opt);
    // noop guard: same value = no mutation
    expect(updateTaskSpy).not.toHaveBeenCalled();
  });
});
