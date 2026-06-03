/**
 * Tiny fetch wrapper for the smart-collab backend.
 *
 * - Always sends credentials (httpOnly cookies carry the access + refresh tokens).
 * - Parses JSON responses + normalizes errors to `ApiError` shape.
 * - On a 401, attempts ONE silent refresh against /api/v1/auth/refresh, then retries.
 * - Shares a single in-flight refresh promise so parallel 401s don't thunder.
 */

export type ApiErrorShape = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
};

export class ApiError extends Error implements ApiErrorShape {
  status: number;
  code: string;
  details?: unknown;
  constructor(p: ApiErrorShape) {
    super(p.message);
    this.name = 'ApiError';
    this.status = p.status;
    this.code = p.code;
    this.details = p.details;
  }
}

const apiBase = (): string => {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (!raw) {
    if (typeof window === 'undefined') return 'http://localhost:4000';
    return '';
  }
  return raw.replace(/\/$/, '');
};

const buildUrl = (path: string): string => {
  if (path.startsWith('http')) return path;
  const base = apiBase();
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`;
};

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

type RequestOptions = {
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

let inFlightRefresh: Promise<boolean> | null = null;

const doRefresh = async (): Promise<boolean> => {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      const r = await fetch(buildUrl('/api/v1/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        inFlightRefresh = null;
      }, 0);
    }
  })();
  return inFlightRefresh;
};

const parseError = async (res: Response): Promise<ApiError> => {
  let body: { error?: { code?: string; message?: string; details?: unknown } } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    // non-json error
  }
  return new ApiError({
    status: res.status,
    code: body.error?.code ?? `HTTP_${res.status}`,
    message: body.error?.message ?? res.statusText ?? 'Request failed',
    details: body.error?.details,
  });
};

const send = async <T>(
  method: Method,
  path: string,
  body?: unknown,
  opts: RequestOptions = {},
  retry = true,
): Promise<T> => {
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(opts.headers ?? {}),
    },
    signal: opts.signal,
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(buildUrl(path), init);

  // Don't try to refresh the refresh endpoint or login endpoints.
  const isAuthEndpoint = path.includes('/api/v1/auth/');

  if (res.status === 401 && retry && !isAuthEndpoint) {
    const ok = await doRefresh();
    if (ok) {
      return send<T>(method, path, body, opts, false);
    }
  }

  if (!res.ok) throw await parseError(res);

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
};

export const apiGet = <T>(path: string, opts?: RequestOptions) => send<T>('GET', path, undefined, opts);
export const apiPost = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  send<T>('POST', path, body, opts);
export const apiPatch = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  send<T>('PATCH', path, body, opts);
export const apiPut = <T>(path: string, body?: unknown, opts?: RequestOptions) =>
  send<T>('PUT', path, body, opts);
export const apiDelete = <T>(path: string, opts?: RequestOptions) =>
  send<T>('DELETE', path, undefined, opts);

// Exposed for tests only.
export const __resetRefreshState = (): void => {
  inFlightRefresh = null;
};
