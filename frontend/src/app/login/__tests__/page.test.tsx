import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { pushSpy, loginSpy, demoLoginSpy, toastErrorSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  loginSpy: vi.fn(),
  demoLoginSpy: vi.fn(),
  toastErrorSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
  useSearchParams: () => new URLSearchParams(),
}));

// Login + demoLogin are now consumed via useLogin/useDemoLogin hooks (TanStack
// mutations) — the hooks still call apiLogin/apiDemoLogin from @/lib/auth so
// mocking the module-level fns still intercepts them.
vi.mock('@/lib/auth', () => ({
  login: (...args: unknown[]) => loginSpy(...args),
  demoLogin: (...args: unknown[]) => demoLoginSpy(...args),
  signup: vi.fn(),
  logout: vi.fn(),
  me: vi.fn().mockResolvedValue({ user: null }),
}));

vi.mock('sonner', () => ({ toast: { error: toastErrorSpy } }));

import LoginPage from '../page';

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe('LoginPage', () => {
  beforeEach(() => {
    pushSpy.mockReset();
    loginSpy.mockReset();
    demoLoginSpy.mockReset();
    toastErrorSpy.mockReset();
  });

  it('renders form fields and demo buttons for 3 roles', () => {
    render(wrap(<LoginPage />));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^admin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^project manager/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^team member/i })).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    const user = userEvent.setup();
    render(wrap(<LoginPage />));
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('submits valid creds, calls login, pushes /dashboard', async () => {
    loginSpy.mockResolvedValue({ user: { id: 'u', email: 'a@b.c', name: 'A', role: 'admin' } });
    const user = userEvent.setup();
    render(wrap(<LoginPage />));
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'pw12345678');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalled();
    });
    expect(loginSpy.mock.calls[0][0]).toEqual({ email: 'a@b.com', password: 'pw12345678' });
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/dashboard'));
  });

  it('demo button calls demoLogin with role, pushes /dashboard', async () => {
    demoLoginSpy.mockResolvedValue({ user: { id: 'u', email: 'admin@demo.local', name: 'A', role: 'admin' } });
    const user = userEvent.setup();
    render(wrap(<LoginPage />));
    await user.click(screen.getByRole('button', { name: /^admin/i }));
    await waitFor(() => expect(demoLoginSpy).toHaveBeenCalled());
    expect(demoLoginSpy.mock.calls[0][0]).toBe('admin');
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows toast on login failure', async () => {
    loginSpy.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    render(wrap(<LoginPage />));
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'pw12345678');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => expect(toastErrorSpy).toHaveBeenCalled());
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
