import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Providers } from '@/components/providers';

const { meSpy, logoutSpy } = vi.hoisted(() => ({
  meSpy: vi.fn(),
  logoutSpy: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth', () => ({
  me: () => meSpy(),
  logout: () => logoutSpy(),
}));

import DashboardPage from '../page';

describe('DashboardPage', () => {
  it('renders shell with KPI placeholders', () => {
    meSpy.mockResolvedValue({
      user: { id: 'u', email: 'me@x.y', name: 'Me', role: 'admin', createdAt: '', updatedAt: '' },
    });
    render(
      <Providers>
        <DashboardPage />
      </Providers>,
    );
    expect(screen.getByRole('heading', { name: /^dashboard$/i })).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });
});
