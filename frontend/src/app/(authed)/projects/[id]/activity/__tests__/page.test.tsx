import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { Providers } from '@/components/providers';

const { meSpy } = vi.hoisted(() => ({ meSpy: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'p-42' }),
}));
vi.mock('@/lib/auth', () => ({ me: () => meSpy(), logout: vi.fn() }));

const { projectActivitySpy } = vi.hoisted(() => ({ projectActivitySpy: vi.fn() }));
vi.mock('@/lib/activity', () => ({
  listActivity: vi.fn(),
  listProjectActivity: (...a: unknown[]) => projectActivitySpy(...a),
}));

import ProjectActivityPage from '../page';

const sample = (id: string) => ({
  id,
  action: 'task.created',
  actorId: 'u-1',
  actorName: 'Alice',
  entityType: 'task',
  entityId: 't-1',
  projectId: 'p-42',
  meta: { title: 'Hello' },
  createdAt: new Date().toISOString(),
});

describe('ProjectActivityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    meSpy.mockResolvedValue({
      user: { id: 'u', email: 'me@x.co', name: 'Me', role: 'admin', createdAt: '', updatedAt: '' },
    });
  });

  it('renders ActivityFeed scoped to project id', async () => {
    projectActivitySpy.mockResolvedValue({
      items: [sample('a-1'), sample('a-2')],
      nextCursor: null,
    });
    render(
      <Providers>
        <ProjectActivityPage />
      </Providers>,
    );
    await waitFor(() => expect(projectActivitySpy).toHaveBeenCalled());
    expect(projectActivitySpy).toHaveBeenCalledWith(
      'p-42',
      expect.objectContaining({ limit: 10 }),
    );
    const aliceRows = await screen.findAllByText('Alice');
    expect(aliceRows.length).toBe(2);
  });

  it('shows page heading "Activity"', async () => {
    projectActivitySpy.mockResolvedValue({ items: [], nextCursor: null });
    render(
      <Providers>
        <ProjectActivityPage />
      </Providers>,
    );
    expect(screen.getByRole('heading', { name: /^activity$/i })).toBeInTheDocument();
  });

  it('back link points to project detail', async () => {
    projectActivitySpy.mockResolvedValue({ items: [], nextCursor: null });
    render(
      <Providers>
        <ProjectActivityPage />
      </Providers>,
    );
    const back = screen.getByRole('link', { name: /back to project/i });
    expect(back).toHaveAttribute('href', '/projects/p-42');
  });

  it('shows "Load more" when nextCursor present and advances on click', async () => {
    projectActivitySpy
      .mockResolvedValueOnce({ items: [sample('a-1')], nextCursor: 'CUR' })
      .mockResolvedValueOnce({ items: [sample('a-2')], nextCursor: null });
    render(
      <Providers>
        <ProjectActivityPage />
      </Providers>,
    );
    await waitFor(() => expect(projectActivitySpy).toHaveBeenCalledTimes(1));
    const btn = await screen.findByRole('button', { name: /load more/i });
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => expect(projectActivitySpy).toHaveBeenCalledTimes(2));
  });

  it('renders empty state when no items', async () => {
    projectActivitySpy.mockResolvedValue({ items: [], nextCursor: null });
    render(
      <Providers>
        <ProjectActivityPage />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText(/no activity yet/i)).toBeInTheDocument());
  });
});
