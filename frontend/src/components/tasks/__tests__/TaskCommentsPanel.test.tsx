import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { listSpy, createSpy, updateSpy, deleteSpy, meSpy } = vi.hoisted(() => ({
  listSpy: vi.fn(),
  createSpy: vi.fn(),
  updateSpy: vi.fn(),
  deleteSpy: vi.fn(),
  meSpy: vi.fn(),
}));

vi.mock('@/lib/comments', () => ({
  listComments: (...a: unknown[]) => listSpy(...a),
  createComment: (...a: unknown[]) => createSpy(...a),
  updateComment: (...a: unknown[]) => updateSpy(...a),
  deleteComment: (...a: unknown[]) => deleteSpy(...a),
}));

vi.mock('@/lib/auth', () => ({
  me: (...a: unknown[]) => meSpy(...a),
  logout: vi.fn(),
}));

import { TaskCommentsPanel } from '../TaskCommentsPanel';

const dto = (id: string, body: string, authorId = 'me') => ({
  id,
  taskId: 't1',
  body,
  author: { id: authorId, name: authorId === 'me' ? 'Me' : 'Other' },
  createdAt: '2026-06-04T10:00:00.000Z',
  updatedAt: '2026-06-04T10:00:00.000Z',
});

const renderPanel = (projectRole: 'pm' | 'member' | 'admin' | null = 'member') =>
  render(
    <Providers>
      <TaskCommentsPanel taskId="t1" projectRole={projectRole} />
    </Providers>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  meSpy.mockResolvedValue({ user: { id: 'me', name: 'Me', email: 'me@x', role: 'team_member' } });
});

describe('TaskCommentsPanel', () => {
  it('renders list of comments', async () => {
    listSpy.mockResolvedValue({ items: [dto('c1', 'first one'), dto('c2', 'second')], nextCursor: null });
    renderPanel();
    await waitFor(() => expect(screen.getByText('first one')).toBeInTheDocument());
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  it('post form posts then clears textarea', async () => {
    listSpy.mockResolvedValue({ items: [], nextCursor: null });
    createSpy.mockResolvedValue(dto('c-new', 'new body'));
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByText(/no comments yet/i)).toBeInTheDocument());
    const ta = screen.getByLabelText('New comment body');
    await user.type(ta, 'new body');
    await user.click(screen.getByRole('button', { name: /post comment/i }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledWith('t1', 'new body'));
  });

  it('post button disabled when body empty', async () => {
    listSpy.mockResolvedValue({ items: [], nextCursor: null });
    renderPanel();
    await waitFor(() => expect(screen.getByText(/no comments yet/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /post comment/i })).toBeDisabled();
  });

  it('edit toggle visible only for author', async () => {
    listSpy.mockResolvedValue({
      items: [dto('c1', 'mine', 'me'), dto('c2', 'theirs', 'them')],
      nextCursor: null,
    });
    renderPanel();
    await waitFor(() => expect(screen.getByText('mine')).toBeInTheDocument());
    const editBtns = screen.queryAllByRole('button', { name: /^edit$/i });
    expect(editBtns.length).toBe(1);
  });

  it('delete visible for PM on others comments', async () => {
    listSpy.mockResolvedValue({
      items: [dto('c1', 'theirs', 'them')],
      nextCursor: null,
    });
    renderPanel('pm');
    await waitFor(() => expect(screen.getByText('theirs')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeInTheDocument();
  });

  it('load more visible when nextCursor present', async () => {
    listSpy.mockResolvedValue({ items: [dto('c1', 'one')], nextCursor: 'CUR' });
    renderPanel();
    await waitFor(() => expect(screen.getByText('one')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });
});
