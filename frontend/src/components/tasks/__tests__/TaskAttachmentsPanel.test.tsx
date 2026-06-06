import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from '@/components/providers';

const { listSpy, uploadSpy, deleteSpy, meSpy } = vi.hoisted(() => ({
  listSpy: vi.fn(),
  uploadSpy: vi.fn(),
  deleteSpy: vi.fn(),
  meSpy: vi.fn(),
}));

vi.mock('@/lib/attachments', async () => {
  const actual = await vi.importActual<typeof import('@/lib/attachments')>('@/lib/attachments');
  return {
    ...actual,
    listAttachments: (...a: unknown[]) => listSpy(...a),
    uploadAttachment: (...a: unknown[]) => uploadSpy(...a),
    deleteAttachment: (...a: unknown[]) => deleteSpy(...a),
  };
});

vi.mock('@/lib/auth', () => ({
  me: (...a: unknown[]) => meSpy(...a),
  logout: vi.fn(),
}));

import { TaskAttachmentsPanel } from '../TaskAttachmentsPanel';

const dto = (id: string, filename: string, uploaderId = 'me', sizeBytes = 100) => ({
  id,
  taskId: 't1',
  filename,
  mimeType: 'text/plain',
  sizeBytes,
  uploader: { id: uploaderId, name: uploaderId === 'me' ? 'Me' : 'Other' },
  createdAt: '2026-06-04T10:00:00.000Z',
});

const renderPanel = (projectRole: 'pm' | 'member' | 'admin' | null = 'member') =>
  render(
    <Providers>
      <TaskAttachmentsPanel taskId="t1" projectRole={projectRole} />
    </Providers>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  meSpy.mockResolvedValue({ user: { id: 'me', name: 'Me', email: 'me@x', role: 'team_member' } });
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4000';
});

describe('TaskAttachmentsPanel', () => {
  it('renders existing attachments', async () => {
    listSpy.mockResolvedValue({ items: [dto('a1', 'doc.pdf'), dto('a2', 'pic.png', 'them')] });
    renderPanel();
    await waitFor(() => expect(screen.getByText('doc.pdf')).toBeInTheDocument());
    expect(screen.getByText('pic.png')).toBeInTheDocument();
  });

  it('file input triggers upload', async () => {
    listSpy.mockResolvedValue({ items: [] });
    uploadSpy.mockResolvedValue(dto('a-new', 'fresh.txt'));
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByText(/no files attached/i)).toBeInTheDocument());
    const file = new File(['hi'], 'fresh.txt', { type: 'text/plain' });
    const input = screen.getByTestId('attachment-file-input') as HTMLInputElement;
    await user.upload(input, file);
    await waitFor(() => expect(uploadSpy).toHaveBeenCalled());
  });

  it('rejects over-size files client-side (no upload call)', async () => {
    listSpy.mockResolvedValue({ items: [] });
    const user = userEvent.setup();
    renderPanel();
    await waitFor(() => expect(screen.getByText(/no files attached/i)).toBeInTheDocument());
    const tooBig = new File([new Uint8Array(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    const input = screen.getByTestId('attachment-file-input') as HTMLInputElement;
    await user.upload(input, tooBig);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('download anchor has correct href', async () => {
    listSpy.mockResolvedValue({ items: [dto('a1', 'doc.pdf')] });
    renderPanel();
    await waitFor(() => expect(screen.getByText('doc.pdf')).toBeInTheDocument());
    const a = screen.getByRole('link', { name: 'doc.pdf' });
    expect(a).toHaveAttribute('href', expect.stringMatching(/\/api\/v1\/attachments\/file\/a1$/));
  });

  it('delete visible to uploader; absent for stranger member', async () => {
    listSpy.mockResolvedValue({
      items: [dto('a1', 'mine.txt', 'me'), dto('a2', 'theirs.txt', 'them')],
    });
    renderPanel('member');
    await waitFor(() => expect(screen.getByText('mine.txt')).toBeInTheDocument());
    const dels = screen.queryAllByRole('button', { name: /^delete$/i });
    expect(dels.length).toBe(1);
  });
});
