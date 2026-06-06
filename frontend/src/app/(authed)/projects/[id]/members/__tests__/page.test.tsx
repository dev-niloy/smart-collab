import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Providers } from '@/components/providers';

const { meSpy, pushSpy, replaceSpy } = vi.hoisted(() => ({
  meSpy: vi.fn(),
  pushSpy: vi.fn(),
  replaceSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'p-1' }),
}));

vi.mock('@/lib/auth', () => ({
  me: () => meSpy(),
  logout: vi.fn(),
}));

const { listSpy } = vi.hoisted(() => ({
  listSpy: vi.fn(),
}));

vi.mock('@/lib/project-members', () => ({
  listProjectMembers: () => listSpy(),
  listAssignableMembers: vi.fn(),
  addProjectMember: vi.fn(),
  updateProjectMemberRole: vi.fn(),
  removeProjectMember: vi.fn(),
}));

import ProjectMembersPage from '../page';

const member = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'm-1',
  projectId: 'p-1',
  userId: 'u-1',
  role: 'member' as const,
  addedAt: '2026-06-04T00:00:00.000Z',
  addedById: 'u-actor',
  user: { id: 'u-1', email: 'alice@x.y', name: 'Alice', role: 'team_member' as const },
  workload: { todo: 2, in_progress: 1, completed: 3, due_soon: 1 },
  ...over,
});

const setUser = (
  role: 'admin' | 'project_manager' | 'team_member',
  id = 'me',
) => {
  meSpy.mockResolvedValue({
    user: { id, email: 'me@x.y', name: 'Me', role, createdAt: '', updatedAt: '' },
  });
};

const renderPage = () => {
  return render(
    <Providers>
      <ProjectMembersPage />
    </Providers>,
  );
};

describe('ProjectMembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders member cards with workload counts', async () => {
    setUser('admin');
    listSpy.mockResolvedValue([
      member(),
      member({ id: 'm-2', userId: 'u-2', role: 'pm', user: { id: 'u-2', email: 'bob@x.y', name: 'Bob', role: 'project_manager' } }),
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    expect(screen.getByText('Bob')).toBeTruthy();
    expect(screen.getByText('alice@x.y')).toBeTruthy();
    expect(screen.getAllByText('Project Manager').length).toBeGreaterThan(0);
  });

  it('admin sees manage actions on each member', async () => {
    setUser('admin');
    listSpy.mockResolvedValue([member()]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('member-actions-m-1')).toBeTruthy());
  });

  it('project pm (member of project as pm) sees manage actions', async () => {
    setUser('project_manager', 'me');
    listSpy.mockResolvedValue([
      member({
        id: 'm-self',
        userId: 'me',
        role: 'pm',
        user: { id: 'me', email: 'me@x.y', name: 'Me', role: 'project_manager' },
      }),
      member(),
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('member-actions-m-1')).toBeTruthy());
  });

  it('non-pm member (project member) sees read-only — no actions', async () => {
    setUser('team_member', 'me');
    listSpy.mockResolvedValue([
      member({
        id: 'm-self',
        userId: 'me',
        role: 'member',
        user: { id: 'me', email: 'me@x.y', name: 'Me', role: 'team_member' },
      }),
      member(),
    ]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Alice')).toBeTruthy());
    expect(screen.queryByTestId('member-actions-m-1')).toBeNull();
  });

  it('shows error retry on load failure', async () => {
    setUser('admin');
    listSpy.mockRejectedValue(new Error('boom'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy(), { timeout: 5000 });
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('shows skeleton while loading', () => {
    setUser('admin');
    listSpy.mockImplementation(() => new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByTestId('members-loading')).toBeTruthy();
  });
});
