import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { pushSpy } = vi.hoisted(() => ({ pushSpy: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushSpy }) }));

const { searchSpy } = vi.hoisted(() => ({ searchSpy: vi.fn() }));
vi.mock('@/lib/search', () => ({
  searchAll: (...a: unknown[]) => searchSpy(...a),
}));

import { GlobalSearchBar } from '../GlobalSearchBar';

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
};

const sampleHit = {
  projects: [
    { id: 'p-1', name: 'Alpha', description: 'desc', status: 'active', deadline: '2026-06-30' },
  ],
  tasks: [
    {
      id: 't-1',
      title: 'fix login',
      description: null,
      projectId: 'p-1',
      projectName: 'Alpha',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-06-30',
    },
  ],
};

describe('GlobalSearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchSpy.mockResolvedValue(sampleHit);
  });

  it('renders the search input', () => {
    render(wrap(<GlobalSearchBar />));
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('"/" key focuses the input', () => {
    render(wrap(<GlobalSearchBar />));
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  });

  it('typing 2+ chars triggers fetch (after debounce)', async () => {
    render(wrap(<GlobalSearchBar />));
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'fo' } });
    await waitFor(() => expect(searchSpy).toHaveBeenCalled(), { timeout: 1000 });
    expect(searchSpy).toHaveBeenCalledWith(expect.objectContaining({ q: 'fo' }));
  });

  it('does not fetch when q.length < 2', async () => {
    render(wrap(<GlobalSearchBar />));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
    await new Promise((r) => setTimeout(r, 300));
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it('Esc closes the results popover', async () => {
    render(wrap(<GlobalSearchBar />));
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'foo' } });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeInTheDocument());
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('renders grouped Projects + Tasks results', async () => {
    render(wrap(<GlobalSearchBar />));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'foo' } });
    await waitFor(() => expect(screen.getByText('Projects')).toBeInTheDocument());
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('fix login')).toBeInTheDocument();
  });

  it('shows empty state when 0 hits', async () => {
    searchSpy.mockResolvedValue({ projects: [], tasks: [] });
    render(wrap(<GlobalSearchBar />));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xx' } });
    await waitFor(() => expect(screen.getByText(/no matches/i)).toBeInTheDocument());
  });
});
