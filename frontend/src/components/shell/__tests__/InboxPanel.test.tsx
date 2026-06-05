import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InboxPanel } from '../InboxPanel';

describe('InboxPanel', () => {
  it('renders Inbox header + 3 tabs (Unread / Mentions / Assigned to me)', () => {
    render(<InboxPanel />);

    expect(screen.getByRole('heading', { level: 2, name: /inbox/i })).toBeInTheDocument();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs.map((t) => t.textContent)).toEqual(['Unread', 'Mentions', 'Assigned to me']);
  });

  it('Unread is selected by default and Mentions switches selection', () => {
    render(<InboxPanel />);
    expect(screen.getByRole('tab', { name: /unread/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: /mentions/i }));
    expect(screen.getByRole('tab', { name: /mentions/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /unread/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('fires onTabChange callback when a tab is clicked', () => {
    const onTabChange = vi.fn();
    render(<InboxPanel onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole('tab', { name: /assigned to me/i }));
    expect(onTabChange).toHaveBeenCalledWith('assigned');
  });

  it('respects initialTab prop', () => {
    render(<InboxPanel initialTab="mentions" />);
    expect(screen.getByRole('tab', { name: /mentions/i })).toHaveAttribute('aria-selected', 'true');
  });
});
