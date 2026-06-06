'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { replaceTaskAssignees } from '@/lib/tasks';
import { useAssignableMembers } from '@/hooks/useProjectMembers';
import { ApiError } from '@/lib/api';

type Props = {
  projectId: string;
  taskId: string;
  currentAssigneeIds: string[];
};

export function TaskAssigneesPanel({ projectId, taskId, currentAssigneeIds }: Props) {
  const qc = useQueryClient();
  const members = useAssignableMembers(projectId);
  const [selected, setSelected] = useState<string[]>(currentAssigneeIds);
  const replace = useMutation({
    mutationFn: (userIds: string[]) => replaceTaskAssignees(taskId, userIds),
    onSuccess: () => {
      toast.success('Assignees updated');
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Failed to update assignees');
    },
  });

  const toggle = (id: string, on: boolean) => {
    const set = new Set(selected);
    if (on) set.add(id);
    else set.delete(id);
    setSelected(Array.from(set));
  };

  const dirty =
    selected.length !== currentAssigneeIds.length ||
    selected.some((id) => !currentAssigneeIds.includes(id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manage assignees</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Pick one or more project members. Only project managers + admins can change this list.
        </p>
        <div
          className="max-h-48 overflow-y-auto rounded-md border bg-background p-2"
          role="group"
          aria-label="Assignee picker"
        >
          {(members.data ?? []).length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No project members available
            </p>
          ) : (
            (members.data ?? []).map((u) => {
              const checked = selected.includes(u.id);
              return (
                <label
                  key={u.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => toggle(u.id, e.target.checked)}
                    aria-label={u.name}
                  />
                  <span className="text-sm">
                    {u.name}{' '}
                    <span className="text-muted-foreground">({u.email})</span>
                  </span>
                </label>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {selected.length === 0 ? 'Unassigned' : `${selected.length} selected`}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!dirty || replace.isPending}
              onClick={() => setSelected(currentAssigneeIds)}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!dirty || replace.isPending}
              onClick={() => replace.mutate(selected)}
            >
              {replace.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
