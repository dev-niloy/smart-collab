'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/hooks/useUser';
import { useUpdateProfile } from '@/hooks/useProfile';
import { ApiError } from '@/lib/api';

export default function ProfileNotificationsPage() {
  const { user, isLoading } = useUser();
  const updateProfile = useUpdateProfile();
  const [override, setOverride] = useState<boolean | null>(null);
  const value = override ?? user?.emailNotifications ?? true;
  const ready = !isLoading && user !== null && user !== undefined;

  const onToggle = async (next: boolean) => {
    const prev = override;
    setOverride(next);
    try {
      await updateProfile.mutateAsync({ emailNotifications: next });
      toast.success(next ? 'Email notifications turned on.' : 'Email notifications turned off.');
      setOverride(null);
    } catch (err) {
      setOverride(prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not update preference.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-10">
      <div className="border-b border-border pb-6">
        <span className="text-eyebrow">Account · Notifications</span>
        <h1 className="mt-2 text-display-md">Notifications</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Control which transactional emails land in your inbox.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email delivery</CardTitle>
          <CardDescription>
            Mentions, comment replies, task assignments, and status changes. In-app notifications stay on regardless.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              role="switch"
              aria-label="Send me transactional emails"
              className="h-4 w-4 cursor-pointer accent-primary"
              checked={value}
              disabled={isLoading || updateProfile.isPending || !ready}
              onChange={(e) => void onToggle(e.target.checked)}
            />
            <span className="text-sm">
              Send me transactional emails when someone mentions, assigns, or replies to me
            </span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
