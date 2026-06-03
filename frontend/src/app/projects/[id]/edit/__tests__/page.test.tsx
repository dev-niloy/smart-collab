import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { meSpy, pushSpy, replaceSpy, getSpy, updateSpy } = vi.hoisted(() => ({
  meSpy: vi.fn(),
  pushSpy: vi.fn(),
  replaceSpy: vi.fn(),
  getSpy: vi.fn(),
  updateSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
  useParams: () => ({ id: 'p-1' }),
}));

vi.mock('@/lib/auth', () => ({
  me: () => meSpy(),
  logout: vi.fn(),
}));

vi.mock('@/lib/projects', () => ({
  getProject: (...a: unknown[]) => getSpy(...a),
  updateProject: (...a: unknown[]) => updateSpy(...a),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
}));

import EditProjectPage from '../page';

const setUser = (role: 'admin' | 'project_manager' | 'team_member') => {
  meSpy.mockResolvedValue({
    user: { id: 'u', email: 'me@x.y', name: 'Me', role, createdAt: '', updatedAt: '' },
  });
};

const sampleProject = {
  id: 'p-1',
  name: 'Launch Site',
  description: 'Rebuild',
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
      <EditProjectPage />
    </Providers>,
  );

describe('EditProjectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('admin: prefills form, submits update, redirects to detail', async () => {
    setUser('admin');
    getSpy.mockResolvedValue(sampleProject);
    updateSpy.mockResolvedValue({ ...sampleProject, name: 'Launch Site v2' });
    const user = userEvent.setup();
    renderPage();

    const nameInput = (await waitFor(() => screen.getByLabelText(/name/i))) as HTMLInputElement;
    await waitFor(() => expect(nameInput.value).toBe('Launch Site'));

    await user.clear(nameInput);
    await user.type(nameInput, 'Launch Site v2');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1));
    const [calledId, payload] = updateSpy.mock.calls[0];
    expect(calledId).toBe('p-1');
    expect(payload.name).toBe('Launch Site v2');
    expect(payload.deadline).toBeInstanceOf(Date);
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/projects/p-1'));
  });

  it('member: redirected to /forbidden', async () => {
    setUser('team_member');
    getSpy.mockResolvedValue(sampleProject);
    renderPage();
    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/forbidden'));
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
