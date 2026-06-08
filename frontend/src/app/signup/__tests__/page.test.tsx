import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { pushSpy, signupSpy, toastErrorSpy } = vi.hoisted(() => ({
  pushSpy: vi.fn(),
  signupSpy: vi.fn(),
  toastErrorSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth', () => ({
  signup: (...args: unknown[]) => signupSpy(...args),
  login: vi.fn(),
  demoLogin: vi.fn(),
  logout: vi.fn(),
  me: vi.fn().mockResolvedValue({ user: null }),
}));
vi.mock('sonner', () => ({ toast: { error: toastErrorSpy } }));

import SignupPage from '../page';

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

describe('SignupPage', () => {
  beforeEach(() => {
    pushSpy.mockReset();
    signupSpy.mockReset();
    toastErrorSpy.mockReset();
  });

  it('renders name + email + password + submit', () => {
    render(wrap(<SignupPage />));
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('submits valid payload and pushes /dashboard', async () => {
    signupSpy.mockResolvedValue({ user: { id: 'u', email: 'a@b.com', name: 'Alice', role: 'team_member' } });
    const user = userEvent.setup();
    render(wrap(<SignupPage />));
    await user.type(screen.getByLabelText(/name/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'pw12345678');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(signupSpy).toHaveBeenCalled());
    expect(signupSpy.mock.calls[0][0]).toEqual({ name: 'Alice', email: 'a@b.com', password: 'pw12345678' });
    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/dashboard'));
  });
});
