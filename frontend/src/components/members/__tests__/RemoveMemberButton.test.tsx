import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { removeSpy, toastSuccess, toastError } = vi.hoisted(() => ({
  removeSpy: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/project-members', () => ({
  removeProjectMember: (...a: unknown[]) => removeSpy(...a),
  addProjectMember: vi.fn(),
  updateProjectMemberRole: vi.fn(),
  listProjectMembers: vi.fn(),
  listAssignableMembers: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
  Toaster: () => null,
}));

import { RemoveMemberButton } from '../RemoveMemberButton';
import { ApiError } from '@/lib/api';

const renderBtn = () =>
  render(
    <Providers>
      <RemoveMemberButton projectId="p-1" memberId="m-1" memberName="Alice" />
    </Providers>,
  );

describe('RemoveMemberButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens dialog w/ correct copy including member name', async () => {
    renderBtn();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => expect(screen.getByText(/remove alice\?/i)).toBeTruthy());
    expect(screen.getByText(/alice's assigned tasks will be unassigned/i)).toBeTruthy();
    expect(screen.getByText(/cannot be undone/i)).toBeTruthy();
  });

  it('confirm fires removeProjectMember + toast.success', async () => {
    removeSpy.mockResolvedValue({ removedMemberId: 'm-1', tasksUnassigned: 2 });
    renderBtn();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^remove$/i }));
    await waitFor(() => screen.getByText(/remove alice\?/i));
    const confirmBtn = screen
      .getAllByRole('button', { name: /^remove$/i })
      .pop()!;
    await user.click(confirmBtn);
    await waitFor(() => expect(removeSpy).toHaveBeenCalledWith('p-1', 'm-1'));
    expect(toastSuccess.mock.calls[0][0]).toMatch(/alice/i);
    expect(toastSuccess.mock.calls[0][0]).toMatch(/2 task/);
  });

  it('cancel closes w/o calling removeProjectMember', async () => {
    renderBtn();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^remove$/i }));
    await waitFor(() => screen.getByText(/remove alice\?/i));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('CANNOT_REMOVE_LAST_PM surfaces toast.error', async () => {
    removeSpy.mockRejectedValue(
      new ApiError({
        status: 422,
        message: 'Cannot remove the last project manager while tasks exist. Promote another member first.',
        code: 'CANNOT_REMOVE_LAST_PM',
      }),
    );
    renderBtn();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^remove$/i }));
    await waitFor(() => screen.getByText(/remove alice\?/i));
    const confirmBtn = screen
      .getAllByRole('button', { name: /^remove$/i })
      .pop()!;
    await user.click(confirmBtn);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/last project manager/i);
  });
});
