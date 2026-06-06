'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { useDeleteTask } from '@/hooks/useTasks';
import { ApiError } from '@/lib/api';

type Props = {
  projectId: string;
  taskId: string;
  taskTitle: string;
};

export function DeleteTaskButton({ projectId, taskId, taskTitle }: Props) {
  const router = useRouter();
  const deleteMutation = useDeleteTask();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const onConfirm = async () => {
    setPending(true);
    try {
      await deleteMutation.mutateAsync(taskId);
      toast.success(`Deleted "${taskTitle}"`);
      setOpen(false);
      router.push(`/projects/${projectId}/tasks`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Delete failed';
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} disabled={pending}>
              {pending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
