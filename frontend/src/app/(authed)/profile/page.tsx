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

type IdentityForm = z.infer<typeof identitySchema>;

export default function ProfilePage() {
  const { user, isLoading } = useUser();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarBust, setAvatarBust] = useState<number>(0);

  const identityForm = useForm<IdentityForm>({
    resolver: zodResolver(identitySchema),
    defaultValues: { name: '', email: '' },
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
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div className="border-b border-border pb-6">
        <span className="text-eyebrow">Account · Profile</span>
        <h1 className="mt-2 text-display-md">Profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Avatar, display name, and email address.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Avatar, display name, and email address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4 border-b border-border pb-5">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-3xl font-semibold text-primary-foreground ring-1 ring-foreground/15">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <span>{(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Avatar</div>
                <div className="text-xs text-muted-foreground">PNG, JPEG, WebP, or GIF — max 2 MB.</div>
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={onAvatarChange}
                />
                <Button type="button" size="sm" onClick={onPickAvatar} disabled={uploadAvatar.isPending}>
                  {uploadAvatar.isPending ? 'Uploading…' : 'Upload'}
                </Button>
                {user?.avatarPath ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onAvatarDelete}
                    disabled={deleteAvatar.isPending}
                  >
                    {deleteAvatar.isPending ? 'Removing…' : 'Remove'}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

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
    </div>
  );
}
