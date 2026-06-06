import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  attachmentDownloadUrl,
} from '../attachments';
import { __resetRefreshState } from '../api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const sampleDTO = {
  id: 'a1',
  taskId: 't1',
  filename: 'doc.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 100,
  uploader: { id: 'u1', name: 'Alice' },
  createdAt: '2026-06-04T10:00:00.000Z',
};

describe('lib/attachments', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('listAttachments GETs metadata list', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { items: [sampleDTO] }));
    vi.stubGlobal('fetch', sp);
    const list = await listAttachments('t1');
    expect(list.items.length).toBe(1);
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/tasks\/t1\/attachments$/),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('uploadAttachment posts multipart FormData', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(201, { attachment: sampleDTO }));
    vi.stubGlobal('fetch', sp);
    const file = new File([new Uint8Array([1, 2, 3])], 'doc.pdf', { type: 'application/pdf' });
    const dto = await uploadAttachment('t1', file);
    expect(dto.id).toBe('a1');
    const [url, init] = sp.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/tasks\/t1\/attachments$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('uploadAttachment surfaces server error envelope as ApiError', async () => {
    const sp = vi.fn().mockResolvedValue(
      mockResponse(422, { error: { code: 'FILE_TOO_LARGE', message: 'File too large' } }, false),
    );
    vi.stubGlobal('fetch', sp);
    const file = new File([new Uint8Array([1])], 'big.pdf', { type: 'application/pdf' });
    await expect(uploadAttachment('t1', file)).rejects.toMatchObject({
      status: 422,
      code: 'FILE_TOO_LARGE',
    });
  });

  it('deleteAttachment fires DELETE; downloadUrl builds full url', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(204));
    vi.stubGlobal('fetch', sp);
    await deleteAttachment('t1', 'a1');
    expect(sp).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/tasks\/t1\/attachments\/a1$/),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(attachmentDownloadUrl('a1')).toMatch(/\/api\/v1\/attachments\/file\/a1$/);
  });
});
