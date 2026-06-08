'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useInvitationLookup, useAcceptInvitation } from '@/hooks/useInvitations';
import { useUser } from '@/hooks/useUser';
import { ApiError } from '@/lib/api';

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function InvitationAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const router = useRouter();
  const lookup = useInvitationLookup(token);
  const accept = useAcceptInvitation();
  const { user, isLoading: userLoading } = useUser();
  const [autoAttempted, setAutoAttempted] = useState(false);

  const inv = lookup.data;
  const matchesUser = useMemo(() => {
    if (!user || !inv) return false;
    return user.email.toLowerCase() === inv.email.toLowerCase();
  }, [user, inv]);

  // Auto-accept once: when invitation is pending AND a logged-in user has the
  // matching email, fire the accept mutation and redirect on success.
  useEffect(() => {
    if (autoAttempted) return;
    if (!inv || userLoading) return;
    if (inv.status !== 'pending') return;
    if (!user) return;
    if (!matchesUser) return;
    setAutoAttempted(true);
    accept
      .mutateAsync(token)
      .then((data) => {
        toast.success(`Joined "${inv.project.name}".`);
        router.replace(`/projects/${data.projectId}`);
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : 'Could not accept invitation.');
      });
  }, [inv, user, userLoading, matchesUser, autoAttempted, accept, router, token]);

  return (
    <main className="flex flex-1 min-h-screen w-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 surface-edge-highlight">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center overflow-hidden rounded-md bg-primary">
            <Image src="/logo.jpg" alt="" width={32} height={32} className="h-8 w-8 object-cover" />
          </div>
          <span className="text-sm font-semibold tracking-tight">Smart Collab</span>
        </div>

        {lookup.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        ) : lookup.isError || !inv ? (
          <div className="space-y-3">
            <span className="text-eyebrow">Invitation</span>
            <h1 className="text-headline">Invitation not found</h1>
            <p className="text-sm text-muted-foreground">
              This link is invalid or has been revoked.
            </p>
            <Link href="/login"><Button variant="secondary">Back to sign in</Button></Link>
          </div>
        ) : inv.status === 'expired' ? (
          <div className="space-y-3">
            <span className="text-eyebrow">Invitation · Expired</span>
            <h1 className="text-headline">This invitation expired</h1>
            <p className="text-sm text-muted-foreground">
              Ask {inv.inviter.name} to send a new invitation to {inv.email}.
            </p>
            <Link href="/login"><Button variant="secondary">Back to sign in</Button></Link>
          </div>
        ) : inv.status === 'revoked' ? (
          <div className="space-y-3">
            <span className="text-eyebrow">Invitation · Revoked</span>
            <h1 className="text-headline">This invitation was revoked</h1>
            <p className="text-sm text-muted-foreground">
              {inv.inviter.name} cancelled this invitation.
            </p>
            <Link href="/login"><Button variant="secondary">Back to sign in</Button></Link>
          </div>
        ) : inv.status === 'accepted' ? (
          <div className="space-y-3">
            <span className="text-eyebrow">Invitation · Accepted</span>
            <h1 className="text-headline">Already accepted</h1>
            <p className="text-sm text-muted-foreground">
              This invitation has been used. Sign in to open the project.
            </p>
            <Link href={user ? `/projects/${inv.project.id}` : '/login'}>
              <Button>{user ? 'Open project' : 'Sign in'}</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <span className="text-eyebrow">You're invited</span>
              <h1 className="text-headline">Join "{inv.project.name}"</h1>
              <p className="text-sm text-muted-foreground">
                {inv.inviter.name} invited <strong>{inv.email}</strong> to collaborate as{' '}
                <strong>{inv.role === 'pm' ? 'Project Manager' : 'Member'}</strong>.
              </p>
              {inv.project.description ? (
                <p className="mt-3 text-sm text-muted-foreground border-l-2 border-border pl-3">
                  {inv.project.description}
                </p>
              ) : null}
              <p className="mt-3 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                Expires {fmtDate(inv.expiresAt)}
              </p>
            </div>

            {userLoading ? (
              <p className="text-sm text-muted-foreground">Checking your session…</p>
            ) : user && matchesUser ? (
              <div className="space-y-2">
                <p className="text-sm">
                  Signed in as <strong>{user.email}</strong>.
                </p>
                <Button
                  className="w-full"
                  onClick={() => {
                    setAutoAttempted(true);
                    accept
                      .mutateAsync(token)
                      .then((data) => router.replace(`/projects/${data.projectId}`))
                      .catch((err) =>
                        toast.error(err instanceof ApiError ? err.message : 'Could not accept.'),
                      );
                  }}
                  disabled={accept.isPending}
                >
                  {accept.isPending ? 'Joining…' : `Join "${inv.project.name}"`}
                </Button>
              </div>
            ) : user && !matchesUser ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">
                  You're signed in as <strong>{user.email}</strong>, but this invitation was sent to{' '}
                  <strong>{inv.email}</strong>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Sign out and either sign in with {inv.email} or sign up using that email.
                </p>
                <div className="flex gap-2">
                  <Link href={`/login?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(inv.email)}`}>
                    <Button variant="secondary">Sign in</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  To accept, sign in or create an account with <strong>{inv.email}</strong>.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link
                    href={`/signup?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(inv.email)}`}
                  >
                    <Button className="w-full">Create account</Button>
                  </Link>
                  <Link
                    href={`/login?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(inv.email)}`}
                  >
                    <Button variant="secondary" className="w-full">Sign in</Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
