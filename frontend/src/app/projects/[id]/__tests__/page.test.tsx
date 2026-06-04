import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Providers } from '@/components/providers';

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

  it('renders View tasks link (all authed)', async () => {
    setUser('team_member');
    getSpy.mockResolvedValue(sampleProject);
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch Site')).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /view tasks/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/projects/p-1/tasks');
  });

  it('renders Members link (all authed) — E21', async () => {
    setUser('team_member');
    getSpy.mockResolvedValue(sampleProject);
    renderPage();
    await waitFor(() => expect(screen.getByText('Launch Site')).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /members/i });
    expect(link).toHaveAttribute('href', '/projects/p-1/members');
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
