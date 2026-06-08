'use client';

import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProjectActivity } from '@/hooks/useActivity';
import { ActivityFeed } from '@/components/activity/ActivityFeed';

export interface ProjectActivityDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ProjectActivityDialog({ projectId, open, onOpenChange }: ProjectActivityDialogProps) {
  const query = useProjectActivity(open ? projectId : '', { limit: 20 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activity</DialogTitle>
          <DialogDescription>Recent events across this project.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-card px-4 py-3 surface-edge-highlight">
          <ActivityFeed query={query} />
        </div>
        <DialogFooter className="mt-2">
          <Link href={`/projects/${projectId}/activity`} onClick={() => onOpenChange(false)}>
            <Button variant="ghost" size="sm">Open full activity →</Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
