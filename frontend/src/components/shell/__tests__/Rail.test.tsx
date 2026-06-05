import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Rail } from '../Rail';

const mockPathname = vi.fn<() => string>(() => '/dashboard');

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
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
});
