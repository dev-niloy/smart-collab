import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityFeed } from '../ActivityFeed';
import type { ActivityDTO } from '@/lib/schemas/activity';

const item = (id: string): ActivityDTO => ({
  id,
  action: 'task.created',
  actorId: 'u-1',
  actorName: 'Alice',
  entityType: 'task',
  entityId: 't-1',
  projectId: 'p-1',
  meta: { title: 'Hello' },
  createdAt: new Date().toISOString(),
});

const baseQuery = () => ({
  data: undefined,
  isPending: false,
  isError: false,
  error: null,
  fetchNextPage: vi.fn().mockResolvedValue(undefined),
  hasNextPage: false,
  isFetchingNextPage: false,
  refetch: vi.fn(),
}) as unknown as Parameters<typeof ActivityFeed>[0]['query'];

describe('ActivityFeed', () => {
  it('renders an ActivityItem per row', () => {
    const q = {
      ...baseQuery(),
      data: { pages: [{ items: [item('a-1'), item('a-2')], nextCursor: null }] },
    } as unknown as Parameters<typeof ActivityFeed>[0]['query'];
    render(<ActivityFeed query={q} />);
    expect(screen.getAllByText('Alice').length).toBe(2);
  });

  it('shows "Load more" when hasNextPage is true', () => {
    const q = {
      ...baseQuery(),
      data: { pages: [{ items: [item('a-1')], nextCursor: 'CUR' }] },
      hasNextPage: true,
    } as unknown as Parameters<typeof ActivityFeed>[0]['query'];
    render(<ActivityFeed query={q} />);
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });

  it('hides "Load more" when hideLoadMore prop is set', () => {
    const q = {
      ...baseQuery(),
      data: { pages: [{ items: [item('a-1')], nextCursor: 'CUR' }] },
      hasNextPage: true,
    } as unknown as Parameters<typeof ActivityFeed>[0]['query'];
    render(<ActivityFeed query={q} hideLoadMore />);
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('renders skeleton on first fetch (isPending)', () => {
    const q = { ...baseQuery(), isPending: true } as unknown as Parameters<typeof ActivityFeed>[0]['query'];
    render(<ActivityFeed query={q} />);
    expect(screen.getByTestId('activity-skeleton')).toBeInTheDocument();
  });

  it('renders empty state when no items', () => {
    const q = {
      ...baseQuery(),
      data: { pages: [{ items: [], nextCursor: null }] },
    } as unknown as Parameters<typeof ActivityFeed>[0]['query'];
    render(<ActivityFeed query={q} />);
    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it('shows error + retry button and calls refetch', () => {
    const refetch = vi.fn();
    const q = {
      ...baseQuery(),
      isError: true,
      error: new Error('boom'),
      refetch,
    } as unknown as Parameters<typeof ActivityFeed>[0]['query'];
    render(<ActivityFeed query={q} />);
    expect(screen.getByText(/couldn’t load activity/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
