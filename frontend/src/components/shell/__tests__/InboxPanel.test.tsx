import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let mockPathname = '/inbox';
let mockSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearch,
}));

import { InboxPanel } from '../InboxPanel';

describe('InboxPanel', () => {
  it('renders Inbox header + 3 sidebar links', () => {
    mockPathname = '/inbox';
    mockSearch = new URLSearchParams();
    render(<InboxPanel />);

    expect(screen.getByRole('heading', { level: 2, name: /inbox/i })).toBeInTheDocument();

    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['Unread', 'Mentions', 'Assigned to me']);
  });

  it('marks Unread active when no tab query is set', () => {
    mockPathname = '/inbox';
    mockSearch = new URLSearchParams();
    render(<InboxPanel />);
    expect(screen.getByRole('link', { name: /unread/i })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: /mentions/i })).toHaveAttribute('data-active', 'false');
  });

  it('marks Mentions active when ?tab=mentions', () => {
    mockPathname = '/inbox';
    mockSearch = new URLSearchParams('tab=mentions');
    render(<InboxPanel />);
    expect(screen.getByRole('link', { name: /mentions/i })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('link', { name: /unread/i })).toHaveAttribute('data-active', 'false');
  });

  it('links carry the correct hrefs', () => {
    mockPathname = '/inbox';
    mockSearch = new URLSearchParams();
    render(<InboxPanel />);
    expect(screen.getByRole('link', { name: /unread/i })).toHaveAttribute('href', '/inbox?tab=unread');
    expect(screen.getByRole('link', { name: /mentions/i })).toHaveAttribute('href', '/inbox?tab=mentions');
    expect(screen.getByRole('link', { name: /assigned to me/i })).toHaveAttribute(
      'href',
      '/inbox?tab=assigned',
    );
  });
});
