import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { pushSpy, loginSpy, demoLoginSpy, toastErrorSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  loginSpy: vi.fn(),
  demoLoginSpy: vi.fn(),
  toastErrorSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
}));

vi.mock('@/lib/auth', () => ({
  login: (...args: unknown[]) => loginSpy(...args),
  demoLogin: (...args: unknown[]) => demoLoginSpy(...args),
}));

vi.mock('sonner', () => ({ toast: { error: toastErrorSpy } }));

import LoginPage from '../page';

describe('LoginPage', () => {
  beforeEach(() => {
    pushSpy.mockReset();
    loginSpy.mockReset();
    demoLoginSpy.mockReset();
    toastErrorSpy.mockReset();
  });

  it('renders form fields and demo buttons for 3 roles', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /demo admin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /demo project manager/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /demo team member/i })).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('submits valid creds → calls login → pushes /dashboard', async () => {
    loginSpy.mockResolvedValue({ user: { id: 'u', email: 'a@b.c', name: 'A', role: 'admin' } });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'pw12345678');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw12345678' });
    });
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/dashboard'));
  });

  it('demo button calls demoLogin with role → pushes /dashboard', async () => {
    demoLoginSpy.mockResolvedValue({ user: { role: 'admin' } });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /demo admin/i }));
    await waitFor(() => expect(demoLoginSpy).toHaveBeenCalledWith('admin'));
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows toast on login failure', async () => {
    loginSpy.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'pw12345678');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalled());
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
