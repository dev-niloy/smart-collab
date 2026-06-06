import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InboxPage from '../page';
import type { Task } from '@/lib/schemas/task';
import type { NotificationDTO } from '@/lib/schemas/notification';

const useNotificationsMock = vi.fn();
const useTasksMock = vi.fn();
const markAllMutate = vi.fn();
const markReadMutate = vi.fn();

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: (opts: unknown) => useNotificationsMock(opts),
  useMarkAllNotificationsRead: () => ({ mutate: markAllMutate, isPending: false }),
  useMarkNotificationRead: () => ({ mutate: markReadMutate, isPending: false }),
}));

vi.mock('@/hooks/useTasks', () => ({
  useTasks: (params: unknown) => useTasksMock(params),
}));

const notif = (over: Partial<NotificationDTO> = {}): NotificationDTO => ({
  id: 'n1',
  userId: 'u1',
  actorId: 'u2',
  actorName: 'PM Dev',
  type: 'task.assigned',
  entityType: 'task',
  entityId: 't1',
  projectId: 'p1',
  payload: { taskTitle: 'Wire up auth', projectId: 'p1', taskId: 't1' },
  readAt: null,
  createdAt: new Date().toISOString(),
  ...over,
}) as NotificationDTO;

const task = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  projectId: 'p1',
  title: 'Wire up auth',
  description: null,
  status: 'todo',
  priority: 'high',
  dueDate: new Date('2026-07-01').toISOString(),
  createdBy: 'u2',
  creator: { id: 'u2', email: 'pm@demo.local', name: 'PM', role: 'project_manager' },
  assignees: [{
    userId: 'u1',
    addedById: 'u2',
    addedAt: new Date().toISOString(),
    user: { id: 'u1', email: 'me@demo.local', name: 'Me', role: 'team_member' },
  }],
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});

describe('InboxPage', () => {
  beforeEach(() => {
    markAllMutate.mockReset();
    markReadMutate.mockReset();
    useNotificationsMock.mockReset();
    useTasksMock.mockReset();
    useNotificationsMock.mockReturnValue({
      data: { pages: [{ items: [notif()], nextCursor: null }] },
    });
    useTasksMock.mockReturnValue({
      data: { data: [task()], total: 1, page: 1, limit: 50 },
    });
  });

  it('renders Inbox topbar + 3 tabs with Unread selected', () => {
    render(<InboxPage />);

    expect(screen.getByText('Inbox')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs.map((t) => t.textContent)).toEqual(['Unread', 'Mentions', 'Assigned to me']);
    expect(screen.getByRole('tab', { name: /^unread$/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('Unread tab pulls the full list (locally filtered) and renders it', () => {
    render(<InboxPage />);
    // Inbox page pulls the full list once and filters tabs locally so that
    // switching tabs never produces a blank tab during a cache miss.
    expect(useNotificationsMock).toHaveBeenLastCalledWith({ limit: 20, unread: false });
    expect(screen.getByText(/PM Dev assigned you to Wire up auth/i)).toBeInTheDocument();
  });

  it('clicking an unread notification fires markRead with its id', () => {
    render(<InboxPage />);
    const link = screen.getByRole('link', { name: /PM Dev assigned you to Wire up auth/i });
    fireEvent.click(link);
    expect(markReadMutate).toHaveBeenCalledTimes(1);
    expect(markReadMutate).toHaveBeenCalledWith('n1');
  });

  it('clicking a read notification on Mentions tab does not double-mark', () => {
    // Defense in depth: Mentions tab can display read items too, but clicking
    // one should be a no-op against markRead since it's already read.
    useNotificationsMock.mockReturnValue({
      data: {
        pages: [
          {
            items: [
              notif({
                id: 'n9',
                type: 'comment.mention',
                readAt: new Date().toISOString(),
                payload: { taskTitle: 'Old mention', projectId: 'p1', taskId: 't1' },
              }),
            ],
            nextCursor: null,
          },
        ],
      },
    });
    render(<InboxPage />);
    fireEvent.click(screen.getByRole('tab', { name: /mentions/i }));
    const link = screen.getByRole('link', { name: /mentioned you on Old mention/i });
    fireEvent.click(link);
    expect(markReadMutate).not.toHaveBeenCalled();
  });

  it('switching to Assigned tab shows tasks assigned to me', () => {
    render(<InboxPage />);

    fireEvent.click(screen.getByRole('tab', { name: /assigned to me/i }));

    expect(useTasksMock).toHaveBeenLastCalledWith({ assignedTo: 'me', limit: 50 });
    expect(screen.getByText('Wire up auth')).toBeInTheDocument();
    expect(screen.getByText(/todo · due/i)).toBeInTheDocument();
  });

  it('Mentions tab filters notifications to mention types only', () => {
    useNotificationsMock.mockReturnValue({
      data: {
        pages: [
          {
            items: [
              notif({ id: 'n1', type: 'task.assigned', payload: { taskTitle: 'A' } }),
              notif({ id: 'n2', type: 'comment.mention', payload: { taskTitle: 'B' } }),
            ],
            nextCursor: null,
          },
        ],
      },
    });
    render(<InboxPage />);
    fireEvent.click(screen.getByRole('tab', { name: /mentions/i }));

    expect(screen.queryByText(/assigned you to A/i)).not.toBeInTheDocument();
    expect(screen.getByText(/mentioned you on B/i)).toBeInTheDocument();
  });

  it('shows "Mark all read" only in Unread tab and triggers the mutation', () => {
    render(<InboxPage />);
    const btn = screen.getByRole('button', { name: /mark all read/i });
    fireEvent.click(btn);
    expect(markAllMutate).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('tab', { name: /assigned to me/i }));
    expect(screen.queryByRole('button', { name: /mark all read/i })).not.toBeInTheDocument();
  });

  it('Assigned tab shows "No tasks assigned" when list is empty', () => {
    useTasksMock.mockReturnValue({ data: { data: [], total: 0, page: 1, limit: 50 } });
    render(<InboxPage />);
    fireEvent.click(screen.getByRole('tab', { name: /assigned to me/i }));
    expect(screen.getByText(/no tasks assigned to you/i)).toBeInTheDocument();
  });
});
