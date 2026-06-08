import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Providers } from '@/components/providers';
import type { ReactNode } from 'react';

const { meSpy, getSpy } = vi.hoisted(() => ({
  meSpy: vi.fn(),
  getSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'p-1' }),
}));

vi.mock('@/lib/auth', () => ({
  me: () => meSpy(),
  logout: vi.fn(),
}));

vi.mock('@/lib/projects', () => ({
  getProject: (...a: unknown[]) => getSpy(...a),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));

const { membersSpy } = vi.hoisted(() => ({ membersSpy: vi.fn() }));
vi.mock('@/lib/project-members', () => ({
  listProjectMembers: () => membersSpy(),
  listAssignableMembers: vi.fn(),
  addProjectMember: vi.fn(),
  updateProjectMemberRole: vi.fn(),
  removeProjectMember: vi.fn(),
}));

import ProjectDetailPage from '../page';

const setUser = (role: 'admin' | 'project_manager' | 'team_member') => {
  meSpy.mockResolvedValue({
    user: { id: 'u', email: 'me@x.y', name: 'Me', role, createdAt: '', updatedAt: '' },
  });
};

const sampleProject = {
  id: 'p-1',
  name: 'Launch Site',
  description: 'Marketing site rebuild',
  deadline: '2030-06-01T00:00:00.000Z',
  status: 'active' as const,
  createdBy: 'u-7',
  creator: { id: 'u-7', email: 'alice@x.y', name: 'Alice' },
  progress: { done: 2, total: 5, percent: 40 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const renderPage = () =>
  render(
    <Providers>
      <ProjectDetailPage />
    </Providers>,
  );

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders project fields + creator email', async () => {
    setUser('admin');
    getSpy.mockResolvedValue(sampleProject);
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch Site')).toBeInTheDocument());
    expect(screen.getByText(/marketing site rebuild/i)).toBeInTheDocument();
    expect(screen.getByText(/alice@x\.y/)).toBeInTheDocument();
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
  });

  it('shows friendly forbidden message when getProject rejects 403', async () => {
    setUser('team_member');
    const { ApiError } = await import('@/lib/api');
    getSpy.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'no access' }),
    );
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    render(<ProjectDetailPage />, { wrapper: Wrapper });
    await waitFor(() =>
      expect(
        screen.getByText(/you do not have access to this project/i),
      ).toBeInTheDocument(),
    );
    const backButtons = screen.getAllByRole('link', { name: /back to projects/i });
    expect(backButtons.length).toBeGreaterThanOrEqual(1);
    expect(backButtons.every((b) => b.getAttribute('href') === '/projects')).toBe(true);
  });

  it('renders progress bar + long label in detail header', async () => {
    setUser('admin');
    getSpy.mockResolvedValue(sampleProject);
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch Site')).toBeInTheDocument());
    expect(screen.getByText('2 of 5 tasks · 40%')).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('progressbar')
        .some((b) => b.getAttribute('aria-valuenow') === '40'),
    ).toBe(true);
  });

  it('renders View tasks link (all authed)', async () => {
    setUser('team_member');
    getSpy.mockResolvedValue(sampleProject);
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch Site')).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /view tasks/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/projects/p-1/tasks');
  });

  it('renders Members button (all authed) — E21', async () => {
    setUser('team_member');
    getSpy.mockResolvedValue(sampleProject);
    membersSpy.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch Site')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /members/i })).toBeInTheDocument();
  });

  it('renders embedded dashboard section on project detail — E15', async () => {
    setUser('team_member');
    getSpy.mockResolvedValue(sampleProject);
    membersSpy.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch Site')).toBeInTheDocument());
    // Dashboard moved inline beneath the project card.
    expect(
      screen.getByRole('heading', { level: 2, name: /project dashboard/i }),
    ).toBeInTheDocument();
  });

  it('renders Activity button on project detail', async () => {
    setUser('team_member');
    getSpy.mockResolvedValue(sampleProject);
    membersSpy.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch Site')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument();
  });

  it('Members button shows count when members are loaded — PM done-criterion #14', async () => {
    setUser('admin');
    getSpy.mockResolvedValue(sampleProject);
    membersSpy.mockResolvedValue([
      { id: 'm-1', userId: 'u-1', role: 'pm', addedAt: '', addedById: null,
        user: { id: 'u-1', email: 'a@x.co', name: 'A', role: 'project_manager' },
        workload: { todo: 0, in_progress: 0, completed: 0, due_soon: 0 }, projectId: 'p-1' },
      { id: 'm-2', userId: 'u-2', role: 'member', addedAt: '', addedById: null,
        user: { id: 'u-2', email: 'b@x.co', name: 'B', role: 'team_member' },
        workload: { todo: 0, in_progress: 0, completed: 0, due_soon: 0 }, projectId: 'p-1' },
      { id: 'm-3', userId: 'u-3', role: 'member', addedAt: '', addedById: null,
        user: { id: 'u-3', email: 'c@x.co', name: 'C', role: 'team_member' },
        workload: { todo: 0, in_progress: 0, completed: 0, due_soon: 0 }, projectId: 'p-1' },
    ]);
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /members \(3\)/i })).toBeInTheDocument(),
    );
  });

  it('admin: shows Edit + Delete buttons', async () => {
    setUser('admin');
    getSpy.mockResolvedValue(sampleProject);
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('member: hides Edit + Delete buttons', async () => {
    setUser('team_member');
    getSpy.mockResolvedValue(sampleProject);
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch Site')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('not-found / error: shows Retry', async () => {
    setUser('admin');
    getSpy.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(
      () => expect(screen.getByText(/not found or failed to load/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  }, 10000);
});
