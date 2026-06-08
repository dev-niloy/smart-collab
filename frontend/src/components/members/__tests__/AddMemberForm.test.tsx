import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { addSpy, inviteSpy, searchData, toastSuccess, toastError } = vi.hoisted(() => ({
  addSpy: vi.fn(),
  inviteSpy: vi.fn(),
  searchData: { current: [] as Array<{ id: string; email: string; name: string; avatarUrl: string | null }> },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/hooks/useProjectMembers', () => ({
  useAddMember: () => ({ mutateAsync: addSpy, isPending: false }),
}));

vi.mock('@/hooks/useInvitations', () => ({
  useCreateInvitation: () => ({ mutateAsync: inviteSpy, isPending: false }),
}));

vi.mock('@/hooks/useUserSearch', () => ({
  useUserSearch: () => ({ data: searchData.current, isLoading: false }),
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
    searchData.current = [];
  });

  it('clicking a search suggestion calls addMember with that user email', async () => {
    searchData.current = [
      { id: 'u-1', email: 'dev@x.co', name: 'Dev One', avatarUrl: null },
    ];
    addSpy.mockResolvedValue({ id: 'm-new', userId: 'u-1', role: 'member' });
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email or name/i), 'dev');
    const option = await screen.findByRole('option', { name: /dev one/i });
    await user.click(option);
    await waitFor(() => expect(addSpy).toHaveBeenCalled());
    expect(addSpy).toHaveBeenCalledWith({ email: 'dev@x.co', role: 'member' });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('typing an unknown email surfaces the Invite fallback and creates an invitation', async () => {
    searchData.current = [];
    inviteSpy.mockResolvedValue({ id: 'inv-1' });
    renderForm();
    const user = userEvent.setup();
    const input = screen.getByLabelText(/email or name/i);
    await user.type(input, 'fresh@x.co');
    const inviteBtn = await screen.findByRole('button', { name: /invite fresh@x\.co/i });
    await user.click(inviteBtn);
    await waitFor(() => expect(inviteSpy).toHaveBeenCalled());
    expect(inviteSpy).toHaveBeenCalledWith({ email: 'fresh@x.co', role: 'member' });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('submit on valid unknown email also routes through invite path', async () => {
    searchData.current = [];
    inviteSpy.mockResolvedValue({ id: 'inv-2' });
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email or name/i), 'new@x.co');
    await user.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() => expect(inviteSpy).toHaveBeenCalled());
    expect(inviteSpy).toHaveBeenCalledWith({ email: 'new@x.co', role: 'member' });
  });

  it('submit button is disabled while query is neither a valid email nor an exact match', () => {
    searchData.current = [];
    renderForm();
    const btn = screen.getByRole('button', { name: /add member/i });
    expect(btn).toBeDisabled();
  });

  it('toasts the API error message when the invitation backend rejects', async () => {
    searchData.current = [];
    inviteSpy.mockRejectedValue(
      new ApiError({
        status: 422,
        message: 'A pending invitation for this email already exists.',
        code: 'INVITATION_PENDING_EXISTS',
      }),
    );
    renderForm();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/email or name/i), 'dup@x.co');
    await user.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/already exists/i);
  });
});
