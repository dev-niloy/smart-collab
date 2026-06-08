'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useChangePassword } from '@/hooks/useProfile';
import { ApiError } from '@/lib/api';

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

type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePasswordPage() {
  const changePassword = useChangePassword();

  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: PasswordForm) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed. Other sessions have been signed out.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Password change failed.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div className="border-b border-border pb-6">
        <span className="text-eyebrow">Account · Password</span>
        <h1 className="mt-2 text-display-md">Password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Changing your password signs out every other tab and device, but keeps this one active.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use at least 8 characters. Mix in numbers + symbols for strength.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <div className="space-y-1">
              <Label htmlFor="profile-current-pw">Current password</Label>
              <Input
                id="profile-current-pw"
                type="password"
                autoComplete="current-password"
                {...form.register('currentPassword')}
              />
              {form.formState.errors.currentPassword ? (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.currentPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-new-pw">New password</Label>
              <Input
                id="profile-new-pw"
                type="password"
                autoComplete="new-password"
                {...form.register('newPassword')}
              />
              {form.formState.errors.newPassword ? (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.newPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="profile-confirm-pw">Confirm new password</Label>
              <Input
                id="profile-confirm-pw"
                type="password"
                autoComplete="new-password"
                {...form.register('confirmPassword')}
              />
              {form.formState.errors.confirmPassword ? (
                <p role="alert" className="text-xs text-destructive">
                  {form.formState.errors.confirmPassword.message}
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
