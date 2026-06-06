import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Rail } from '../Rail';

const mockPathname = vi.fn<() => string>(() => '/dashboard');
const mockUnreadData = vi.fn<() => { data: { count: number } | undefined }>(() => ({
  data: { count: 0 },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useUnreadCount: () => mockUnreadData(),
}));

describe('Rail (top nav)', () => {
  it('renders workspace logo + 4 nav items (Search, Dashboard, Projects, Inbox) with accessible names', () => {
    mockPathname.mockReturnValue('/dashboard');
    render(<Rail />);

    expect(screen.getByLabelText(/workspace/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /projects/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /inbox/i })).toBeInTheDocument();
  });

  it('marks Dashboard active when pathname is /dashboard', () => {
    mockPathname.mockReturnValue('/dashboard');
    render(<Rail />);

    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: /projects/i })).toHaveAttribute('data-active', 'false');
    expect(screen.getByRole('link', { name: /inbox/i })).toHaveAttribute('data-active', 'false');
  });

  it('marks Projects active when pathname is /projects', () => {
    mockPathname.mockReturnValue('/projects');
    render(<Rail />);

    expect(screen.getByRole('link', { name: /projects/i })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('data-active', 'false');
  });

  it('keeps Projects active on nested routes (prefix-match)', () => {
    mockPathname.mockReturnValue('/projects/abc-123/tasks/def-456');
    render(<Rail />);

    expect(screen.getByRole('link', { name: /projects/i })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('data-active', 'false');
    expect(screen.getByRole('link', { name: /inbox/i })).toHaveAttribute('data-active', 'false');
  });

  it('marks Inbox active when pathname is /inbox', () => {
    mockPathname.mockReturnValue('/inbox');
    render(<Rail />);

    expect(screen.getByRole('link', { name: /inbox/i })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: /projects/i })).toHaveAttribute('data-active', 'false');
  });

  it('Search is not a link and has no active state', () => {
    mockPathname.mockReturnValue('/dashboard');
    render(<Rail />);

    const search = screen.getByRole('button', { name: /search/i });
    expect(search).not.toHaveAttribute('href');
    expect(search).not.toHaveAttribute('data-active');
  });

  it('shows no unread dot on Inbox when count is 0', () => {
    mockPathname.mockReturnValue('/dashboard');
    mockUnreadData.mockReturnValue({ data: { count: 0 } });
    render(<Rail />);

    expect(screen.queryByTestId('inbox-unread-dot')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^inbox$/i })).toHaveAttribute('data-unread', 'false');
  });

  it('shows red unread dot + count in aria-label when unread > 0', () => {
    mockPathname.mockReturnValue('/dashboard');
    mockUnreadData.mockReturnValue({ data: { count: 3 } });
    render(<Rail />);

    expect(screen.getByTestId('inbox-unread-dot')).toBeInTheDocument();
    const inbox = screen.getByRole('link', { name: /inbox \(3 unread\)/i });
    expect(inbox).toHaveAttribute('data-unread', 'true');
  });

  it('handles missing unread query data gracefully (no dot)', () => {
    mockPathname.mockReturnValue('/dashboard');
    mockUnreadData.mockReturnValue({ data: undefined });
    render(<Rail />);

    expect(screen.queryByTestId('inbox-unread-dot')).not.toBeInTheDocument();
  });
});
