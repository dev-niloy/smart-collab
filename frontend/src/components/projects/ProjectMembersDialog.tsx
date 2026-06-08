'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useUser } from '@/hooks/useUser';
import { MemberCard } from '@/components/members/MemberCard';
import { AddMemberForm } from '@/components/members/AddMemberForm';
import { RemoveMemberButton } from '@/components/members/RemoveMemberButton';
import { RoleSelect } from '@/components/members/RoleSelect';
import { InvitationsList } from '@/components/members/InvitationsList';

export interface ProjectMembersDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ProjectMembersDialog({ projectId, open, onOpenChange }: ProjectMembersDialogProps) {
  const { user } = useUser();
  const { data: members, isLoading, isError, refetch } = useProjectMembers(open ? projectId : '');

  const isAdmin = user?.role === 'admin';
  const isProjectPm = !!members?.some((m) => m.userId === user?.id && m.role === 'pm');
  const isPrivileged = isAdmin || isProjectPm;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Team members</DialogTitle>
          <DialogDescription>Manage who can read or change this project.</DialogDescription>
        </DialogHeader>

        {isPrivileged ? (
          <div className="rounded-md border border-border bg-card px-4 py-3 surface-edge-highlight">
            <AddMemberForm projectId={projectId} />
          </div>
        ) : null}

        {isPrivileged ? (
          <InvitationsList projectId={projectId} canManage={isPrivileged} />
        ) : null}

        {isLoading ? (
          <div className="space-y-3" data-testid="members-dialog-loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 w-full animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : isError || !members ? (
          <div className="flex flex-col items-start gap-3 py-4">
            <p className="text-sm text-destructive" role="alert">Failed to load members.</p>
            <Button variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : members.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                actions={
                  isPrivileged ? (
                    <div data-testid={`member-actions-${m.id}`} className="flex items-center gap-2">
                      <RoleSelect projectId={projectId} memberId={m.id} currentRole={m.role} />
                      <RemoveMemberButton projectId={projectId} memberId={m.id} memberName={m.user.name} />
                    </div>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
