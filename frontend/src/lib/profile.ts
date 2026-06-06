import { apiDelete, apiGet, apiPatch } from './api';
import type { PublicUser } from './auth';

export type PublicUserWithAvatar = PublicUser & {
  avatarUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UpdateProfileInput = {
  name?: string;
  email?: string;
};

export type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

export const getProfile = () =>
  apiGet<{ user: PublicUserWithAvatar }>('/api/v1/users/me');

export const updateProfile = (input: UpdateProfileInput) =>
  apiPatch<{ user: PublicUserWithAvatar }>('/api/v1/users/me', input);

export const changePassword = (input: ChangePasswordInput) =>
  apiPatch<{ ok: true }>('/api/v1/users/me/password', input);

/**
 * Avatar upload bypasses the JSON `apiPost` helper because it ships
 * multipart/form-data. Auth + refresh fallback still apply via the
 * default credentials: include + the BE 401 retry contract.
 */
export const uploadAvatar = async (file: File): Promise<{ user: PublicUserWithAvatar }> => {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/v1/users/me/avatar', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? 'Avatar upload failed');
  }
  return res.json();
};

export const deleteAvatar = () =>
  apiDelete<{ user: PublicUserWithAvatar }>('/api/v1/users/me/avatar');
