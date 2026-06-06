'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  type TaskStatus,
  type TaskPriority,
} from '@/lib/schemas/task';
import { STATUS_LABEL, PRIORITY_LABEL } from '@/lib/task-format';
import { useTask, useUpdateTask } from '@/hooks/useTasks';
import { useAssignableMembers, useProjectMembers } from '@/hooks/useProjectMembers';
import { useUser } from '@/hooks/useUser';
import { ApiError } from '@/lib/api';
import { AssigneesMultiSelect } from '@/components/tasks/AssigneesMultiSelect';
import { replaceTaskAssignees } from '@/lib/tasks';

const formSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  dueDate: z.string().min(1, 'Due date is required'),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
});

type FormValues = z.infer<typeof formSchema>;

const toDateInput = (iso: string): string => {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
};

export default function EditTaskPage() {
  const router = useRouter();
  const routeParams = useParams<{ id: string; taskId: string }>();
  const projectId = routeParams?.id ?? '';
  const taskId = routeParams?.taskId ?? '';
  const { data: task, isLoading, isError } = useTask(taskId);
  const updateMutation = useUpdateTask(taskId);
  const assignableQuery = useAssignableMembers(projectId);
  const { data: members } = useProjectMembers(projectId);
  const { user } = useUser();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const isAdmin = user?.role === 'admin';
  const isProjectPm =
    !!user && !!members?.some((m) => m.userId === user.id && m.role === 'pm');
  const canManageAssignees = isAdmin || isProjectPm;

  const initialAssigneeIds = useMemo(() => {
    if (!task) return [];
    if (task.assignees && task.assignees.length > 0) {
      return task.assignees.map((a) => a.userId);
    }
    return task.assignedTo ? [task.assignedTo] : [];
  }, [task]);

  useEffect(() => {
    setAssigneeIds(initialAssigneeIds);
  }, [initialAssigneeIds]);

  const assigneesDirty =
    assigneeIds.length !== initialAssigneeIds.length ||
    assigneeIds.some((id) => !initialAssigneeIds.includes(id));

  const replaceAssigneesMutation = useMutation({
    mutationFn: (userIds: string[]) => replaceTaskAssignees(taskId, userIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      dueDate: '',
      status: 'todo',
      priority: 'medium',
    },
  });

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description ?? '',
        dueDate: toDateInput(task.dueDate),
        status: task.status,
        priority: task.priority,
      });
    }
  }, [task, reset]);

  const statusValue = watch('status') ?? 'todo';
  const priorityValue = watch('priority') ?? 'medium';

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        title: data.title,
        description: data.description ?? '',
        dueDate: new Date(data.dueDate),
        status: data.status,
        priority: data.priority,
      });
      if (canManageAssignees && assigneesDirty) {
        await replaceAssigneesMutation.mutateAsync(assigneeIds);
      }
      toast.success('Task updated');
      router.push(`/projects/${projectId}/tasks/${taskId}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Update failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const assigneeOptions = useMemo(
    () =>
      (assignableQuery.data ?? []).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      })),
    [assignableQuery.data],
  );

  const readOnlyAssignees = useMemo(() => {
    if (!task) return [] as Array<{ id: string; name: string; email: string }>;
    if (task.assignees && task.assignees.length > 0) {
      return task.assignees.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
      }));
    }
    if (task.assignee) {
      return [
        { id: task.assignee.id, name: task.assignee.name, email: task.assignee.email },
      ];
    }
    return [];
  }, [task]);

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">Loading task…</p>
            </CardContent>
          </Card>
        ) : isError || !task ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-destructive" role="alert">
                Task not found.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Edit task</CardTitle>
              <CardDescription>Update title, description, status, priority, due date, or assignee.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...register('title')} />
                  {errors.title && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.title.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" rows={4} {...register('description')} />
                  {errors.description && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.description.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due date</Label>
                    <Input id="dueDate" type="date" {...register('dueDate')} />
                    {errors.dueDate && (
                      <p role="alert" className="text-sm text-destructive">
                        {errors.dueDate.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select
                      value={priorityValue}
                      onValueChange={(v) => setValue('priority', v as TaskPriority)}
                    >
                      <SelectTrigger aria-label="Priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PRIORITY_LABEL[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={statusValue}
                      onValueChange={(v) => setValue('status', v as TaskStatus)}
                    >
                      <SelectTrigger aria-label="Status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assignees</Label>
                  {canManageAssignees ? (
                    <AssigneesMultiSelect
                      options={assigneeOptions}
                      value={assigneeIds}
                      onChange={setAssigneeIds}
                      placeholder="Unassigned"
                      emptyMessage="No project members match that search."
                    />
                  ) : (
                    <div
                      className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/30 px-3 py-2"
                      role="group"
                      aria-label="Assignees (read-only)"
                    >
                      {readOnlyAssignees.length === 0 ? (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      ) : (
                        readOnlyAssignees.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center rounded-full bg-background px-2 py-0.5 text-xs ring-1 ring-foreground/15"
                            title={u.email}
                          >
                            {u.name}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                  {canManageAssignees ? (
                    <p className="text-xs text-muted-foreground">
                      Search by name or email. Only project managers + admins can change this list.
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Link
                    href={`/projects/${projectId}/tasks/${taskId}`}
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  >
                    Cancel
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
