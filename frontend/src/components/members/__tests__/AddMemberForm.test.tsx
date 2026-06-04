import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { addSpy, toastSuccess, toastError } = vi.hoisted(() => ({
  addSpy: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/project-members', () => ({
  addProjectMember: (...a: unknown[]) => addSpy(...a),
  updateProjectMemberRole: vi.fn(),
  removeProjectMember: vi.fn(),
  listProjectMembers: vi.fn(),
  listAssignableMembers: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
  Toaster: () => null,
}));

import { AddMemberForm } from '../AddMemberForm';
import { ApiError } from '@/lib/api';

const renderForm = () =>
  render(
    <Providers>
      <AddMemberForm projectId="p-1" />
    </Providers>,
  );

describe('AddMemberForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits valid email + default role member', async () => {
    addSpy.mockResolvedValue({ id: 'm-new', userId: 'u-new', role: 'member' });
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'new@x.co');
    await user.click(screen.getByRole('button', { name: /add member/i }));
    await waitFor(() => expect(addSpy).toHaveBeenCalledTimes(1));
    expect(addSpy).toHaveBeenCalledWith('p-1', { email: 'new@x.co', role: 'member' });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('shows inline error when email is invalid', async () => {
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /add member/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('surfaces ALREADY_MEMBER toast on duplicate', async () => {
    addSpy.mockRejectedValue(
      new ApiError({ status: 422, message: 'User is already a member of this project.', code: 'ALREADY_MEMBER' }),
    );
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'dup@x.co');
    await user.click(screen.getByRole('button', { name: /add member/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/already a member/i);
  });

  it('surfaces USER_NOT_FOUND toast on unknown email', async () => {
    addSpy.mockRejectedValue(
      new ApiError({ status: 404, message: 'No user found with that email.', code: 'USER_NOT_FOUND' }),
    );
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email/i), 'who@x.co');
    await user.click(screen.getByRole('button', { name: /add member/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/no user/i);
  });

  it('resets email field on success', async () => {
    addSpy.mockResolvedValue({ id: 'm-new', userId: 'u-new', role: 'member' });
    renderForm();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/email/i) as HTMLInputElement;
    await user.type(input, 'new@x.co');
    await user.click(screen.getByRole('button', { name: /add member/i }));
    await waitFor(() => expect(input.value).toBe(''));
  });
});
