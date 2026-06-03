import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { meSpy, pushSpy, replaceSpy, createSpy } = vi.hoisted(() => ({
  meSpy: vi.fn(),
  pushSpy: vi.fn(),
  replaceSpy: vi.fn(),
  createSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
}));

vi.mock('@/lib/auth', () => ({
  me: () => meSpy(),
  logout: vi.fn(),
}));

vi.mock('@/lib/projects', () => ({
  createProject: (...a: unknown[]) => createSpy(...a),
  listProjects: vi.fn(),
  getProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));

import NewProjectPage from '../page';

const setUser = (role: 'admin' | 'project_manager' | 'team_member') => {
  meSpy.mockResolvedValue({
    user: { id: 'u', email: 'me@x.y', name: 'Me', role, createdAt: '', updatedAt: '' },
  });
};

const renderPage = () =>
  render(
    <Providers>
      <NewProjectPage />
    </Providers>,
  );

describe('NewProjectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin: submits valid form, calls createProject, redirects to detail', async () => {
    setUser('admin');
    createSpy.mockResolvedValue({
      id: 'p-99',
      name: 'X',
      description: null,
      deadline: '2030-01-01T00:00:00.000Z',
      status: 'active',
      createdBy: 'u',
      createdAt: '',
      updatedAt: '',
    });
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText(/new project/i)).toBeInTheDocument());

    await user.type(screen.getByLabelText(/name/i), 'Launch Site');
    await user.type(screen.getByLabelText(/deadline/i), '2030-06-01');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    const arg = createSpy.mock.calls[0][0];
    expect(arg.name).toBe('Launch Site');
    expect(arg.deadline).toBeInstanceOf(Date);
    expect(arg.status).toBe('active');
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/projects/p-99'));
  });

  it('member: redirected to /forbidden', async () => {
    setUser('team_member');
    renderPage();
    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/forbidden'));
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('shows validation error when name empty', async () => {
    setUser('admin');
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument());
    await user.type(screen.getByLabelText(/deadline/i), '2030-06-01');
    await user.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => expect(screen.getByText(/name is required/i)).toBeInTheDocument());
    expect(createSpy).not.toHaveBeenCalled();
  });
});
