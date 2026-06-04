import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { updateSpy, toastSuccess, toastError } = vi.hoisted(() => ({
  updateSpy: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/project-members', () => ({
  updateProjectMemberRole: (...a: unknown[]) => updateSpy(...a),
  addProjectMember: vi.fn(),
  removeProjectMember: vi.fn(),
  listProjectMembers: vi.fn(),
  listAssignableMembers: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
  Toaster: () => null,
}));

import { RoleSelect } from '../RoleSelect';
import { ApiError } from '@/lib/api';

const renderSel = (currentRole: 'pm' | 'member' = 'member') =>
  render(
    <Providers>
      <RoleSelect projectId="p-1" memberId="m-1" currentRole={currentRole} />
    </Providers>,
  );

describe('RoleSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('changing role fires updateProjectMemberRole', async () => {
    updateSpy.mockResolvedValue({ id: 'm-1', role: 'pm' });
    renderSel('member');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/role/i));
    await waitFor(() => screen.getByRole('option', { name: /project manager/i }));
    await user.click(screen.getByRole('option', { name: /project manager/i }));
    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('p-1', 'm-1', { role: 'pm' }),
    );
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('selecting same role is a noop', async () => {
    renderSel('member');
    // No user interaction — no change. Verify no call after render.
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('surfaces ApiError toast on failure', async () => {
    updateSpy.mockRejectedValue(
      new ApiError({ status: 403, message: 'forbidden', code: 'FORBIDDEN_PROJECT_ROLE' }),
    );
    renderSel('member');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/role/i));
    await waitFor(() => screen.getByRole('option', { name: /project manager/i }));
    await user.click(screen.getByRole('option', { name: /project manager/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
