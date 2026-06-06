import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { meSpy, replaceSpy, pushSpy, paramsRef } = vi.hoisted(() => ({
  meSpy: vi.fn(),
  replaceSpy: vi.fn(),
  pushSpy: vi.fn(),
  paramsRef: { current: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
  useSearchParams: () => paramsRef.current,
  useParams: () => ({ id: 'p-1' }),
}));

vi.mock('@/lib/auth', () => ({
  me: () => meSpy(),
  logout: vi.fn(),
}));

const { listTasksForProjectSpy, updateTaskSpy, listUsersSpy } = vi.hoisted(() => ({
  listTasksForProjectSpy: vi.fn(),
  updateTaskSpy: vi.fn(),
  listUsersSpy: vi.fn(),
}));

vi.mock('@/lib/tasks', () => ({
  listTasks: vi.fn(),
  listTasksForProject: (...a: unknown[]) => listTasksForProjectSpy(...a),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: (...a: unknown[]) => updateTaskSpy(...a),
  deleteTask: vi.fn(),
}));

vi.mock('@/lib/users', () => ({
  listUsers: () => listUsersSpy(),
}));

import ProjectTasksPage from '../page';

const sampleTask = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 't-1',
  projectId: 'p-1',
  title: 'Ship docs',
  description: null,
  status: 'todo',
  priority: 'medium',
  dueDate: '2030-01-01T00:00:00.000Z',
  createdBy: 'u-7',
  creator: { id: 'u-7', email: 'alice@x.y', name: 'Alice', role: 'admin' },
  assignees: [],
  deletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const setUser = (role: 'admin' | 'project_manager' | 'team_member') => {
  meSpy.mockResolvedValue({
    user: { id: 'u', email: 'me@x.y', name: 'Me', role, createdAt: '', updatedAt: '' },
  });
};

const renderPage = (search = '') => {
  paramsRef.current = new URLSearchParams(search);
  return render(
    <Providers>
      <ProjectTasksPage />
    </Providers>,
  );
};

describe('ProjectTasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paramsRef.current = new URLSearchParams();
    listUsersSpy.mockResolvedValue([]);
  });

  it('renders task cards', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({
      data: [sampleTask({ id: 'a', title: 'Alpha' }), sampleTask({ id: 'b', title: 'Beta' })],
      total: 2,
      page: 1,
      limit: 10,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText(/2 tasks/i)).toBeInTheDocument();
  });

  it('member sees New Task button (members can create)', async () => {
    setUser('team_member');
    listTasksForProjectSpy.mockResolvedValue({ data: [sampleTask()], total: 1, page: 1, limit: 10 });
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument());
  });

  it('debounced search updates URL with q=', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({ data: [sampleTask()], total: 1, page: 1, limit: 10 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Ship docs')).toBeInTheDocument());
    await user.type(screen.getByLabelText(/search tasks/i), 'hello');
    await waitFor(
      () => {
        const urls = replaceSpy.mock.calls.map((c) => String(c[0]));
        expect(urls.some((u) => u.includes('q=hello'))).toBe(true);
      },
      { timeout: 1500 },
    );
  });

  it('empty + no filters -> "No tasks yet" + Create CTA', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /create your first task/i })).toBeInTheDocument();
  });

  it('empty + filters -> "No tasks match" + clear filters', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });
    renderPage('status=todo');
    await waitFor(() => expect(screen.getByText(/no tasks match/i)).toBeInTheDocument());
    const clear = screen.getByRole('button', { name: /clear filters/i });
    const user = userEvent.setup();
    await user.click(clear);
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toBe('/projects/p-1/tasks');
  });

  it('error -> Retry button', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(
      () => expect(screen.getByText(/failed to load tasks/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  }, 10000);

  it('pagination: Next advances page=2 in URL; Prev disabled on page 1', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({
      data: [sampleTask()],
      total: 25,
      page: 1,
      limit: 10,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Ship docs')).toBeInTheDocument());
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /prev/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /next/i }));
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain('page=2');
  });

  it('inline status select fires updateTask', async () => {
    setUser('admin');
    const task = sampleTask({ id: 't-9', title: 'Inline change' });
    listTasksForProjectSpy.mockResolvedValue({ data: [task], total: 1, page: 1, limit: 10 });
    updateTaskSpy.mockResolvedValue({ ...task, status: 'in_progress' });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Inline change')).toBeInTheDocument());
    const trigger = screen.getByLabelText(/status for inline change/i);
    await user.click(trigger);
    const opt = await screen.findByRole('option', { name: /in progress/i });
    await user.click(opt);
    await waitFor(() => expect(updateTaskSpy).toHaveBeenCalled());
    const [calledId, payload] = updateTaskSpy.mock.calls[0];
    expect(calledId).toBe('t-9');
    expect(payload).toMatchObject({ status: 'in_progress' });
  });

  it('multi-status chips reflect csv URL state', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({ data: [sampleTask()], total: 1, page: 1, limit: 10 });
    renderPage('status=todo,in_progress');
    await waitFor(() => expect(screen.getByText('Ship docs')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^todo$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /in progress/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking priority chip updates URL csv', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({ data: [sampleTask()], total: 1, page: 1, limit: 10 });
    const user = userEvent.setup();
    renderPage('priority=high');
    await waitFor(() => expect(screen.getByText('Ship docs')).toBeInTheDocument());
    const med = screen.getByRole('button', { name: /^medium$/i });
    await user.click(med);
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain('priority=high%2Cmedium');
  });

  it('dueFrom date input updates URL', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({ data: [sampleTask()], total: 1, page: 1, limit: 10 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Ship docs')).toBeInTheDocument());
    const from = screen.getByLabelText('Due from');
    await user.type(from, '2026-06-04');
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain('dueFrom=2026-06-04');
  });

  it('"Assigned to me" toggle updates URL', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({ data: [sampleTask()], total: 1, page: 1, limit: 10 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Ship docs')).toBeInTheDocument());
    const toggle = screen.getByRole('button', { name: /assigned to me/i });
    await user.click(toggle);
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain('assignedTo=me');
  });

  it('"Created by me" toggle updates URL', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({ data: [sampleTask()], total: 1, page: 1, limit: 10 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Ship docs')).toBeInTheDocument());
    const toggle = screen.getByRole('button', { name: /created by me/i });
    await user.click(toggle);
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain('createdBy=me');
  });

  it('reloading restores all filter state from URL', async () => {
    setUser('admin');
    listTasksForProjectSpy.mockResolvedValue({ data: [sampleTask()], total: 1, page: 1, limit: 10 });
    renderPage('status=todo,completed&priority=high,low&dueFrom=2026-06-04&dueTo=2026-12-31&assignedTo=me&createdBy=me');
    await waitFor(() => expect(screen.getByText('Ship docs')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^todo$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /completed/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^high$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^low$/i })).toHaveAttribute('aria-pressed', 'true');
    expect((screen.getByLabelText('Due from') as HTMLInputElement).value).toBe('2026-06-04');
    expect((screen.getByLabelText('Due to') as HTMLInputElement).value).toBe('2026-12-31');
    expect(screen.getByRole('button', { name: /assigned to me/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /created by me/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
