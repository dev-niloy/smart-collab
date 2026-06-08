'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useProjectInvitations,
  useRevokeInvitation,
} from '@/hooks/useInvitations';
import type { ProjectInvitation } from '@/lib/invitations';
import { ApiError } from '@/lib/api';

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const STATUS_STYLES: Record<ProjectInvitation['status'], string> = {
  pending: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  accepted: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  expired: 'border-muted bg-muted/40 text-muted-foreground',
  revoked: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const STATUS_LABEL: Record<ProjectInvitation['status'], string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  expired: 'Expired',
  revoked: 'Revoked',
};

export interface InvitationsListProps {
  projectId: string;
  canManage: boolean;
}

export function InvitationsList({ projectId, canManage }: InvitationsListProps) {
  const { data, isLoading, isError, refetch } = useProjectInvitations(canManage ? projectId : undefined);
  const revokeMutation = useRevokeInvitation(projectId);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!canManage) return null;

  const onCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Invitation link copied.');
    } catch {
      toast.error('Could not copy link.');
    }
  };

  const onRevoke = async (id: string) => {
    setBusyId(id);
    try {
      await revokeMutation.mutateAsync(id);
      toast.success('Invitation revoked.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Revoke failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Invitations
        </span>
        {data && data.length > 0 ? (
          <span className="text-[11px] text-muted-foreground">{data.length}</span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
      ) : isError ? (
        <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
          <p className="text-xs text-destructive">Failed to load invitations.</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : !data || data.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
          No invitations sent yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border bg-card surface-edge-highlight">
          {data.map((inv) => (
            <li key={inv.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 grow">
                <div className="truncate text-sm text-foreground">{inv.email}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  <span>Role: {inv.role}</span>
                  <span className="mx-1.5 text-border">·</span>
                  <span>Sent {fmtDate(inv.createdAt)}</span>
                  {inv.status === 'pending' ? (
                    <>
                      <span className="mx-1.5 text-border">·</span>
                      <span>Expires {fmtDate(inv.expiresAt)}</span>
                    </>
                  ) : null}
                  {inv.acceptedAt ? (
                    <>
                      <span className="mx-1.5 text-border">·</span>
                      <span>Accepted {fmtDate(inv.acceptedAt)}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <span
                className={
                  'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ' +
                  STATUS_STYLES[inv.status]
                }
              >
                {STATUS_LABEL[inv.status]}
              </span>
              {inv.status === 'pending' && inv.acceptUrl ? (
                <button
                  type="button"
                  aria-label="Copy invitation link"
                  onClick={() => onCopy(inv.acceptUrl as string)}
                  className="shrink-0 rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
              {inv.status === 'pending' ? (
                <button
                  type="button"
                  aria-label="Revoke invitation"
                  onClick={() => onRevoke(inv.id)}
                  disabled={busyId === inv.id}
                  className="shrink-0 rounded-md border border-destructive/40 bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
