import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAttachments, useUploadAttachment, useDeleteAttachment, attachmentsKey } from '../useAttachments';
import { __resetRefreshState } from '@/lib/api';

const mockResponse = (status: number, body?: unknown, ok = status >= 200 && status < 300): Response =>
  ({
    ok,
    status,
    statusText: 'mock',
    json: async () => (body ?? {}) as unknown,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  }) as unknown as Response;

const sample = {
  id: 'a1',
  taskId: 't1',
  filename: 'doc.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 100,
  uploader: { id: 'u1', name: 'Alice' },
  createdAt: '2026-06-04T10:00:00.000Z',
};

const makeWrapper = (qc: QueryClient) => {
  const W = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  W.displayName = 'QC';
  return W;
};
const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('useAttachments hooks', () => {
  beforeEach(() => {
    __resetRefreshState();
    vi.restoreAllMocks();
  });

  it('useAttachments lists and useUploadAttachment invalidates', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { items: [sample] }));
    vi.stubGlobal('fetch', sp);
    const qc = makeClient();
    const { result } = renderHook(() => useAttachments('t1'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0].filename).toBe('doc.pdf');

    sp.mockResolvedValue(mockResponse(201, { attachment: sample }));
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const upload = renderHook(() => useUploadAttachment('t1'), { wrapper: makeWrapper(qc) });
    const file = new File([new Uint8Array([1])], 'doc.pdf', { type: 'application/pdf' });
    await act(async () => {
      await upload.result.current.mutateAsync(file);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: attachmentsKey('t1') });
  });

  it('useDeleteAttachment deletes and invalidates', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(204));
    vi.stubGlobal('fetch', sp);
    const qc = makeClient();
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteAttachment('t1'), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('a1');
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: attachmentsKey('t1') });
  });

  it('useAttachments is disabled when taskId empty', async () => {
    const sp = vi.fn().mockResolvedValue(mockResponse(200, { items: [] }));
    vi.stubGlobal('fetch', sp);
    const { result } = renderHook(() => useAttachments(''), { wrapper: makeWrapper(makeClient()) });
    // Without enabled trigger, isLoading stays false and no fetch made
    await new Promise((r) => setTimeout(r, 50));
    expect(sp).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
