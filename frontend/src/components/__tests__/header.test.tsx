import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Providers } from '@/components/providers';

const { meSpy } = vi.hoisted(() => ({ meSpy: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/auth', () => ({ me: () => meSpy(), logout: vi.fn() }));

import { Header } from '../header';

describe('Header nav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authed: renders Dashboard + Projects nav links + Logout', async () => {
    meSpy.mockResolvedValue({
      user: { id: 'u', email: 'me@x.y', name: 'Me', role: 'admin', createdAt: '', updatedAt: '' },
    });
    render(
      <Providers>
        <Header />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByRole('link', { name: /projects/i })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /^dashboard$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('unauthed: no Projects nav link, no Logout', async () => {
    meSpy.mockRejectedValue(new Error('not authed'));
    render(
      <Providers>
        <Header />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText(/smart collab/i)).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: /projects/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });
});
