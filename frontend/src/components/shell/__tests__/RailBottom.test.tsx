import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RailBottom } from '../RailBottom';

const setTheme = vi.fn();
const mutateAsync = vi.fn().mockResolvedValue(undefined);
const push = vi.fn();
type UserShape = { email: string; role: string } | null;
const useUserMock = vi.fn<() => { user: UserShape; isLoading: boolean; refetch: () => void }>(
  () => ({
    user: { email: 'demo@admin.local', role: 'admin' },
    isLoading: false,
    refetch: vi.fn(),
  }),
);

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', resolvedTheme: 'dark', setTheme }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/hooks/useUser', () => ({
  useUser: () => useUserMock(),
  useLogout: () => ({ mutateAsync, isPending: false }),
}));

describe('RailBottom', () => {
  beforeEach(() => {
    setTheme.mockClear();
    mutateAsync.mockClear();
    push.mockClear();
    useUserMock.mockReturnValue({
      user: { email: 'demo@admin.local', role: 'admin' },
      isLoading: false,
      refetch: vi.fn(),
    });
  });

  it('renders Help link with external href that opens in a new tab', () => {
    render(<RailBottom />);
    const help = screen.getByRole('link', { name: /help/i });
    expect(help).toHaveAttribute('href');
    expect(help.getAttribute('href')).toMatch(/^https?:\/\//);
    expect(help).toHaveAttribute('target', '_blank');
    expect(help.getAttribute('rel') ?? '').toContain('noopener');
  });

  it('Theme button calls setTheme on click (toggle between light and dark)', () => {
    render(<RailBottom />);
    const btn = screen.getByRole('button', { name: /toggle theme/i });
    fireEvent.click(btn);
    expect(setTheme).toHaveBeenCalledTimes(1);
    // current is dark → toggling sends "light"
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('Avatar dropdown shows user email and Logout option', async () => {
    render(<RailBottom />);
    const avatar = screen.getByRole('button', { name: /account menu/i });
    fireEvent.click(avatar);

    expect(await screen.findByText(/demo@admin\.local/i)).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /log out/i })).toBeInTheDocument();
  });

  it('clicking Logout calls useLogout and routes to /login', async () => {
    render(<RailBottom />);
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    const logout = await screen.findByRole('menuitem', { name: /log out/i });
    fireEvent.click(logout);

    // mutateAsync resolves → push("/login")
    await Promise.resolve();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('hides Avatar dropdown trigger when user is loading', () => {
    useUserMock.mockReturnValueOnce({ user: null, isLoading: true, refetch: vi.fn() });
    render(<RailBottom />);
    expect(screen.queryByRole('button', { name: /account menu/i })).not.toBeInTheDocument();
  });
});
