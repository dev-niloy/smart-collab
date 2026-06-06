'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  changePassword,
  deleteAvatar,
  updateProfile,
  uploadAvatar,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@/lib/profile';

const USER_KEY = ['auth', 'me'] as const;

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: USER_KEY });
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => changePassword(input),
  });
};

export const useUploadAvatar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: USER_KEY });
    },
  });
};

export const useDeleteAvatar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteAvatar(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: USER_KEY });
    },
  });
};
