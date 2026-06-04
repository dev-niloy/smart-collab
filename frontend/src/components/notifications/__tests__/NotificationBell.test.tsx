import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { listSpy, countSpy, markReadSpy, markAllSpy, pushSpy } = vi.hoisted(() => ({
  listSpy: vi.fn(),
  countSpy: vi.fn(),
  markReadSpy: vi.fn(),
  markAllSpy: vi.fn(),
  pushSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

vi.mock('@/lib/notifications', () => ({
  listNotifications: (...a: unknown[]) => listSpy(...a),
  getUnreadCount: (...a: unknown[]) => countSpy(...a),
  markNotificationRead: (...a: unknown[]) => markReadSpy(...a),
  markAllNotificationsRead: (...a: unknown[]) => markAllSpy(...a),
}));

vi.mock('@/lib/auth', () => ({ me: vi.fn(), logout: vi.fn() }));

import { NotificationBell } from '../NotificationBell';

const dto = (id: string, opts: { read?: boolean; type?: string } = {}) => ({
  id,
  type: opts.type ?? 'task.assigned',
  actorId: 'u1',
  actorName: 'Alice',
  entityType: 'task',
  entityId: 'task-' + id,
  projectId: 'p1',
  payload: { taskTitle: `Task ${id}`, taskId: 'task-' + id, projectId: 'p1' },
  readAt: opts.read ? '2026-06-04T10:01:00.000Z' : null,
  createdAt: '2026-06-04T10:00:00.000Z',
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationBell', () => {
  it('renders bell button', async () => {
    countSpy.mockResolvedValue({ count: 0 });
    listSpy.mockResolvedValue({ items: [], nextCursor: null });
    render(<Providers><NotificationBell /></Providers>);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument(),
    );
  });

  it('shows unread badge w/ count', async () => {
    countSpy.mockResolvedValue({ count: 3 });
    listSpy.mockResolvedValue({ items: [], nextCursor: null });
    render(<Providers><NotificationBell /></Providers>);
    await waitFor(() => expect(screen.getByTestId('unread-badge')).toHaveTextContent('3'));
    expect(screen.getByRole('button', { name: /3 unread/i })).toBeInTheDocument();
  });

  it('dropdown opens on click and lists items', async () => {
    countSpy.mockResolvedValue({ count: 2 });
    listSpy.mockResolvedValue({ items: [dto('1'), dto('2')], nextCursor: null });
    const user = userEvent.setup();
    render(<Providers><NotificationBell /></Providers>);
    await waitFor(() => expect(screen.getByTestId('unread-badge')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await waitFor(() => expect(screen.getByText(/assigned you to Task 1/)).toBeInTheDocument());
    expect(screen.getByText(/assigned you to Task 2/)).toBeInTheDocument();
  });

  it('mark-all-read invokes markAll mutation', async () => {
    countSpy.mockResolvedValue({ count: 2 });
    listSpy.mockResolvedValue({ items: [dto('1'), dto('2')], nextCursor: null });
    markAllSpy.mockResolvedValue({ updated: 2 });
    const user = userEvent.setup();
    render(<Providers><NotificationBell /></Providers>);
    await waitFor(() => expect(screen.getByTestId('unread-badge')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /mark all read/i })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /mark all read/i }));
    await waitFor(() => expect(markAllSpy).toHaveBeenCalled());
  });

  it('clicking item marks it read and navigates', async () => {
    countSpy.mockResolvedValue({ count: 1 });
    listSpy.mockResolvedValue({ items: [dto('1')], nextCursor: null });
    markReadSpy.mockResolvedValue({ ...dto('1'), readAt: '2026-06-04T10:01:00.000Z' });
    const user = userEvent.setup();
    render(<Providers><NotificationBell /></Providers>);
    await waitFor(() => expect(screen.getByTestId('unread-badge')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await waitFor(() => expect(screen.getByText(/assigned you to Task 1/)).toBeInTheDocument());
    await user.click(screen.getByText(/assigned you to Task 1/));
    await waitFor(() => expect(markReadSpy).toHaveBeenCalledWith('1'));
    expect(pushSpy).toHaveBeenCalledWith('/projects/p1/tasks/task-1');
  });

  it('caught-up message when no items', async () => {
    countSpy.mockResolvedValue({ count: 0 });
    listSpy.mockResolvedValue({ items: [], nextCursor: null });
    const user = userEvent.setup();
    render(<Providers><NotificationBell /></Providers>);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await waitFor(() => expect(screen.getByText(/all caught up/i)).toBeInTheDocument());
  });
});
