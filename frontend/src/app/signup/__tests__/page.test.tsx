import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { pushSpy, signupSpy, toastErrorSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  signupSpy: vi.fn(),
  toastErrorSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushSpy }) }));
vi.mock('@/lib/auth', () => ({ signup: (...args: unknown[]) => signupSpy(...args) }));
vi.mock('sonner', () => ({ toast: { error: toastErrorSpy } }));

import SignupPage from '../page';

describe('SignupPage', () => {
  beforeEach(() => {
    pushSpy.mockReset();
    signupSpy.mockReset();
    toastErrorSpy.mockReset();
  });

  it('renders name + email + password + submit', () => {
    render(<SignupPage />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('submits valid payload and pushes /dashboard', async () => {
    signupSpy.mockResolvedValue({ user: { id: 'u' } });
    const user = userEvent.setup();
    render(<SignupPage />);
    await user.type(screen.getByLabelText(/name/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'pw12345678');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() =>
      expect(signupSpy).toHaveBeenCalledWith({ name: 'Alice', email: 'a@b.com', password: 'pw12345678' }),
    );
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/dashboard'));
  });
});
