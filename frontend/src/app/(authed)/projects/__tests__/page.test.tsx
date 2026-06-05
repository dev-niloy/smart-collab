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
}));

vi.mock('@/lib/auth', () => ({
  me: () => meSpy(),
  logout: vi.fn(),
}));

const { listSpy } = vi.hoisted(() => ({ listSpy: vi.fn() }));
vi.mock('@/lib/projects', () => ({
  listProjects: (...a: unknown[]) => listSpy(...a),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));

import ProjectsPage from '../page';

const sampleProject = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'p-1',
  name: 'Alpha',
  description: null,
  deadline: '2030-01-01T00:00:00.000Z',
  status: 'active',
  createdBy: 'u-1',
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
      <ProjectsPage />
    </Providers>,
  );
};

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paramsRef.current = new URLSearchParams();
  });

  it('renders cards from hook data', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({
      data: [sampleProject({ id: 'a', name: 'Alpha' }), sampleProject({ id: 'b', name: 'Beta' })],
      total: 2,
      page: 1,
      limit: 10,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('2 projects')).toBeInTheDocument();
  });

  it('shows New Project button for admin', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({ data: [sampleProject()], total: 1, page: 1, limit: 10 });
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument());
  });

  it('hides New Project button for member', async () => {
    setUser('team_member');
    listSpy.mockResolvedValue({ data: [sampleProject()], total: 1, page: 1, limit: 10 });
    renderPage();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /new project/i })).not.toBeInTheDocument();
  });

  it('debounces search input then pushes ?q= to URL', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({ data: [sampleProject()], total: 1, page: 1, limit: 10 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    const input = screen.getByLabelText('Search projects');
    await user.type(input, 'hello');
    await waitFor(
      () => {
        const calls = replaceSpy.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => u.includes('q=hello'))).toBe(true);
      },
      { timeout: 1500 },
    );
  });

  it('empty + no filters → "No projects yet"', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no projects yet/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /create your first project/i })).toBeInTheDocument();
  });

  it('empty + filters → "No projects match your filters" with clear button', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });
    renderPage('q=zzz');
    await waitFor(() =>
      expect(screen.getByText(/no projects match your filters/i)).toBeInTheDocument(),
    );
    const clear = screen.getByRole('button', { name: /clear filters/i });
    const user = userEvent.setup();
    await user.click(clear);
    expect(replaceSpy).toHaveBeenCalled();
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toBe('/projects');
  });

  it('error state renders Retry button', async () => {
    setUser('admin');
    listSpy.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(
      () => expect(screen.getByText(/failed to load projects/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  }, 10000);

  it('Next button advances page in URL; Prev disabled on page 1', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({
      data: [sampleProject()],
      total: 25,
      page: 1,
      limit: 10,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    const prev = screen.getByRole('button', { name: /prev/i });
    expect(prev).toBeDisabled();
    const next = screen.getByRole('button', { name: /next/i });
    await user.click(next);
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain('page=2');
  });

  it('renders multi-status chips with active state from URL csv', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({ data: [sampleProject()], total: 1, page: 1, limit: 10 });
    renderPage('status=active,on_hold');
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    const activeChip = screen.getByRole('button', { name: /^active$/i });
    const onHoldChip = screen.getByRole('button', { name: /on hold/i });
    expect(activeChip).toHaveAttribute('aria-pressed', 'true');
    expect(onHoldChip).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking a status chip toggles + updates URL via csv', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({ data: [sampleProject()], total: 1, page: 1, limit: 10 });
    const user = userEvent.setup();
    renderPage('status=active');
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    const onHold = screen.getByRole('button', { name: /on hold/i });
    await user.click(onHold);
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain('status=active%2Con_hold');
  });

  it('deadlineFrom input updates URL', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({ data: [sampleProject()], total: 1, page: 1, limit: 10 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    const from = screen.getByLabelText('Deadline from');
    await user.type(from, '2026-06-04');
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain('deadlineFrom=2026-06-04');
  });

  it('"Created by me" toggle updates URL', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({ data: [sampleProject()], total: 1, page: 1, limit: 10 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    const toggle = screen.getByRole('button', { name: /created by me/i });
    await user.click(toggle);
    const lastUrl = String(replaceSpy.mock.calls.at(-1)?.[0]);
    expect(lastUrl).toContain('createdBy=me');
  });

  it('reloading restores all filters via URL', async () => {
    setUser('admin');
    listSpy.mockResolvedValue({ data: [sampleProject()], total: 1, page: 1, limit: 10 });
    renderPage('status=active,completed&deadlineFrom=2026-06-04&deadlineTo=2026-12-31&createdBy=me');
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^active$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /completed/i })).toHaveAttribute('aria-pressed', 'true');
    expect((screen.getByLabelText('Deadline from') as HTMLInputElement).value).toBe('2026-06-04');
    expect((screen.getByLabelText('Deadline to') as HTMLInputElement).value).toBe('2026-12-31');
    expect(screen.getByRole('button', { name: /created by me/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
