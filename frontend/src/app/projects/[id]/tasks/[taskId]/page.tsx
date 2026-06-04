'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTask } from '@/hooks/useTasks';
import { useUser } from '@/hooks/useUser';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  fmtDate,
  fmtDateTime,
} from '@/lib/task-format';

export default function TaskDetailPage() {
  const routeParams = useParams<{ id: string; taskId: string }>();
  const projectId = routeParams?.id ?? '';
  const taskId = routeParams?.taskId ?? '';
  const { user } = useUser();
  const { data: task, isLoading, isError, refetch } = useTask(taskId);

  const role = user?.role;
  const isPrivileged = role === 'admin' || role === 'project_manager';
  const isOwner =
    !!user && !!task && (task.createdBy === user.id || task.assignedTo === user.id);
  const canEdit = isPrivileged || isOwner;
  const canDelete = isPrivileged;

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Link
          href={`/projects/${projectId}/tasks`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to tasks
        </Link>

        {isLoading ? (
          <Card className="mt-4">
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">Loading task…</p>
            </CardContent>
          </Card>
        ) : isError || !task ? (
          <Card className="mt-4">
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <p className="text-sm text-destructive" role="alert">
                Task not found or failed to load.
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-4">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">{task.title}</CardTitle>
                <CardDescription>
                  Created by {task.creator.name} ({task.creator.email})
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge variant={STATUS_VARIANT[task.status]}>{STATUS_LABEL[task.status]}</Badge>
                <Badge variant={PRIORITY_VARIANT[task.priority]}>
                  {PRIORITY_LABEL[task.priority]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.description ? (
                <p className="whitespace-pre-wrap text-sm">{task.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description.</p>
              )}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Due date</dt>
                  <dd>{fmtDate(task.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Assignee</dt>
                  <dd>
                    {task.assignee ? (
                      <span>
                        {task.assignee.name}{' '}
                        <span className="text-muted-foreground">({task.assignee.email})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd>{fmtDateTime(task.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Updated</dt>
                  <dd>{fmtDateTime(task.updatedAt)}</dd>
                </div>
              </dl>

              {canEdit || canDelete ? (
                <div className="flex gap-2 pt-2">
                  {canEdit ? (
                    <Link href={`/projects/${projectId}/tasks/${task.id}/edit`}>
                      <Button variant="outline">Edit</Button>
                    </Link>
                  ) : null}
                  {canDelete ? (
                    <Button variant="destructive" disabled aria-label="Delete (coming in t19)">
                      Delete
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
