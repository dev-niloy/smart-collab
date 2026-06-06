'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/hooks/useUser';
import {
  useChangePassword,
  useDeleteAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from '@/hooks/useProfile';
import { ApiError } from '@/lib/api';
import { avatarUrlFor } from '@/lib/auth';

const identitySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Invalid email'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please retype the new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type IdentityForm = z.infer<typeof identitySchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, isLoading } = useUser();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarBust, setAvatarBust] = useState<number>(0);

  const identityForm = useForm<IdentityForm>({
    resolver: zodResolver(identitySchema),
    defaultValues: { name: '', email: '' },
  });
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (user) {
      identityForm.reset({ name: user.name, email: user.email });
    }
  }, [user, identityForm]);

  const onIdentitySubmit = async (data: IdentityForm) => {
    const dirty: { name?: string; email?: string } = {};
    if (data.name !== user?.name) dirty.name = data.name;
    if (data.email !== user?.email) dirty.email = data.email;
    if (!dirty.name && !dirty.email) {
      toast.info('Nothing changed.');
      return;
    }
    try {
      await updateProfile.mutateAsync(dirty);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Update failed.');
    }
  };

  const onPasswordSubmit = async (data: PasswordForm) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed. Other sessions have been signed out.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Password change failed.');
    }
  };

  const onPickAvatar = () => fileInputRef.current?.click();

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await uploadAvatar.mutateAsync(file);
      setAvatarBust(Date.now());
      toast.success('Avatar updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Avatar upload failed.');
    }
  };

  const onAvatarDelete = async () => {
    try {
      await deleteAvatar.mutateAsync();
      setAvatarBust(Date.now());
      toast.success('Avatar removed.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Avatar delete failed.');
    }
  };

  const baseAvatarUrl = avatarUrlFor(user);
  const avatarSrc = baseAvatarUrl ? `${baseAvatarUrl}&bust=${avatarBust}` : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Your profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Avatar</CardTitle>
          <CardDescription>PNG, JPEG, WebP, or GIF — max 2 MB.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-primary text-3xl font-semibold text-primary-foreground ring-1 ring-foreground/15">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>{(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={onAvatarChange}
            />
            <Button type="button" onClick={onPickAvatar} disabled={uploadAvatar.isPending}>
              {uploadAvatar.isPending ? 'Uploading…' : 'Upload'}
            </Button>
            {user?.avatarPath ? (
              <Button
                type="button"
                variant="outline"
                onClick={onAvatarDelete}
                disabled={deleteAvatar.isPending}
              >
                {deleteAvatar.isPending ? 'Removing…' : 'Remove'}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Display name + email address.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={identityForm.handleSubmit(onIdentitySubmit)}
            noValidate
          >
            <div className="space-y-1">
              <Label htmlFor="profile-name">Name</Label>
              <Input id="profile-name" disabled={isLoading} {...identityForm.register('name')} />
              {identityForm.formState.errors.name ? (
                <p role="alert" className="text-xs text-destructive">
                  {identityForm.formState.errors.name.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" type="email" disabled={isLoading} {...identityForm.register('email')} />
              {identityForm.formState.errors.email ? (
                <p role="alert" className="text-xs text-destructive">
                  {identityForm.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Changing your password signs out every other tab and device, but keeps this one active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            noValidate
          >
            <div className="space-y-1">
              <Label htmlFor="profile-current-pw">Current password</Label>
              <Input
                id="profile-current-pw"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register('currentPassword')}
              />
              {passwordForm.formState.errors.currentPassword ? (
                <p role="alert" className="text-xs text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-new-pw">New password</Label>
              <Input
                id="profile-new-pw"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register('newPassword')}
              />
              {passwordForm.formState.errors.newPassword ? (
                <p role="alert" className="text-xs text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-confirm-pw">Confirm new password</Label>
              <Input
                id="profile-confirm-pw"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register('confirmPassword')}
              />
              {passwordForm.formState.errors.confirmPassword ? (
                <p role="alert" className="text-xs text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" disabled={changePassword.isPending}>
              {changePassword.isPending ? 'Saving…' : 'Change password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
