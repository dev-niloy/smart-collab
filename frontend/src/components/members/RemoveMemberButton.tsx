'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useRemoveMember } from '@/hooks/useProjectMembers';
import { ApiError } from '@/lib/api';

type Props = {
  projectId: string;
  memberId: string;
  memberName: string;
};

export function RemoveMemberButton({ projectId, memberId, memberName }: Props) {
  const removeMutation = useRemoveMember(projectId);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const onConfirm = async () => {
    setPending(true);
    try {
      const out = await removeMutation.mutateAsync(memberId);
      toast.success(
        out.tasksUnassigned > 0
          ? `Removed ${memberName} — ${out.tasksUnassigned} task(s) unassigned`
          : `Removed ${memberName}`,
      );
      setOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Remove failed';
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Remove
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Their assigned tasks will be unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} disabled={pending}>
              {pending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
