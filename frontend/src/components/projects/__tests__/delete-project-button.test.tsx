import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { pushSpy, deleteSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  deleteSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: vi.fn() }),
}));

vi.mock('@/lib/auth', () => ({ me: vi.fn(), logout: vi.fn() }));

vi.mock('@/lib/projects', () => ({
  deleteProject: (...a: unknown[]) => deleteSpy(...a),
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));

import { DeleteProjectButton } from '../delete-project-button';

const renderBtn = () =>
  render(
    <Providers>
      <DeleteProjectButton projectId="p-1" projectName="Launch Site" />
    </Providers>,
  );

describe('DeleteProjectButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens dialog on click and shows confirmation copy', async () => {
    const user = userEvent.setup();
    renderBtn();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByText(/delete project\?/i)).toBeInTheDocument());
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument();
  });

  it('confirm: calls deleteProject then router.push /projects', async () => {
    deleteSpy.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderBtn();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByText(/delete project\?/i)).toBeInTheDocument());
    const confirm = screen.getAllByRole('button', { name: /^delete$/i }).at(-1)!;
    await user.click(confirm);
    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('p-1'));
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/projects'));
  });

  it('cancel: closes dialog without calling deleteProject', async () => {
    const user = userEvent.setup();
    renderBtn();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByText(/delete project\?/i)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByText(/delete project\?/i)).not.toBeInTheDocument());
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
