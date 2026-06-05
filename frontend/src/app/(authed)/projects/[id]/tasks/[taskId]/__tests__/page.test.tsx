import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Providers } from '@/components/providers';

const { meSpy, getTaskSpy } = vi.hoisted(() => ({
  meSpy: vi.fn(),
  getTaskSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'p-1', taskId: 't-1' }),
}));

vi.mock('@/lib/auth', () => ({
  me: () => meSpy(),
  logout: vi.fn(),
}));

vi.mock('@/lib/tasks', () => ({
  getTask: (...a: unknown[]) => getTaskSpy(...a),
  listTasks: vi.fn(),
  listTasksForProject: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock('@/lib/comments', () => ({
  listComments: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock('@/lib/attachments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/attachments')>('@/lib/attachments');
  return {
    ...actual,
    listAttachments: vi.fn().mockResolvedValue({ items: [] }),
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  };
});

import TaskDetailPage from '../page';

type UserOpts = {
  id?: string;
  role: 'admin' | 'project_manager' | 'team_member';
};

const setUser = (opts: UserOpts) => {
  meSpy.mockResolvedValue({
    user: {
      id: opts.id ?? 'user-self',
      email: 'me@x.y',
      name: 'Me',
      role: opts.role,
      createdAt: '',
      updatedAt: '',
    },
  });
};

const sampleTask = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 't-1',
  projectId: 'p-1',
  title: 'Launch site',
  description: 'Marketing rebuild',
  status: 'todo' as const,
  priority: 'high' as const,
  dueDate: '2030-06-01T00:00:00.000Z',
  assignedTo: null,
  createdBy: 'creator-7',
  creator: { id: 'creator-7', email: 'alice@x.y', name: 'Alice', role: 'admin' as const },
  assignee: null,
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...over,
});

const renderPage = () =>
  render(
    <Providers>
      <TaskDetailPage />
    </Providers>,
  );

describe('TaskDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders fields + creator + assignee=Unassigned', async () => {
    setUser({ role: 'admin' });
    getTaskSpy.mockResolvedValue(sampleTask());
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch site')).toBeInTheDocument());
    expect(screen.getByText(/marketing rebuild/i)).toBeInTheDocument();
    expect(screen.getByText(/alice@x\.y/)).toBeInTheDocument();
    expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
  });

  it('admin: shows Edit link + Delete button', async () => {
    setUser({ role: 'admin' });
    getTaskSpy.mockResolvedValue(sampleTask());
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('PM: shows Edit link + Delete button', async () => {
    setUser({ role: 'project_manager' });
    getTaskSpy.mockResolvedValue(sampleTask());
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('member NOT owner: hides Edit and Delete', async () => {
    setUser({ id: 'member-9', role: 'team_member' });
    getTaskSpy.mockResolvedValue(sampleTask()); // createdBy=creator-7, assignedTo=null
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch site')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('member who is creator: shows Edit, hides Delete', async () => {
    setUser({ id: 'creator-7', role: 'team_member' });
    getTaskSpy.mockResolvedValue(sampleTask());
    renderPage();
    await waitFor(() => expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('member who is assignee: shows Edit, hides Delete', async () => {
    setUser({ id: 'assignee-3', role: 'team_member' });
    getTaskSpy.mockResolvedValue(
      sampleTask({
        assignedTo: 'assignee-3',
        assignee: { id: 'assignee-3', email: 'm@x.y', name: 'Member', role: 'team_member' },
      }),
    );
    renderPage();
    await waitFor(() => expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('renders TaskCommentsPanel below detail card', async () => {
    setUser({ role: 'admin' });
    getTaskSpy.mockResolvedValue(sampleTask());
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /comments/i })).toBeInTheDocument());
    expect(screen.getByLabelText('New comment body')).toBeInTheDocument();
  });

  it('renders TaskAttachmentsPanel below detail card', async () => {
    setUser({ role: 'admin' });
    getTaskSpy.mockResolvedValue(sampleTask());
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /attachments/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /upload file/i })).toBeInTheDocument();
  });

  it('existing detail fields still rendered alongside panels', async () => {
    setUser({ role: 'admin' });
    getTaskSpy.mockResolvedValue(sampleTask());
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch site')).toBeInTheDocument());
    expect(screen.getByText(/marketing rebuild/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /comments/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /attachments/i })).toBeInTheDocument();
  });

  it('error/missing: Retry shown', async () => {
    setUser({ role: 'admin' });
    getTaskSpy.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(
      () => expect(screen.getByText(/not found or failed to load/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  }, 10000);
});
