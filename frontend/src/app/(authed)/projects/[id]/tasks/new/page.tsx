'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';

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
import { useCreateTask } from '@/hooks/useTasks';
import { useAssignableMembers } from '@/hooks/useProjectMembers';
import { ApiError } from '@/lib/api';

const formSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  dueDate: z.string().min(1, 'Due date is required'),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  assigneeIds: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewTaskPage() {
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const projectId = routeParams?.id ?? '';
  const createMutation = useCreateTask();
  const assigneeQuery = useAssignableMembers(projectId);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      dueDate: '',
      status: 'todo',
      priority: 'medium',
      assigneeIds: [],
    },
  });

  const statusValue = watch('status') ?? 'todo';
  const priorityValue = watch('priority') ?? 'medium';
  const assigneeIdsValue = watch('assigneeIds') ?? [];

  const toggleAssignee = (id: string, on: boolean) => {
    const current = new Set(assigneeIdsValue);
    if (on) current.add(id);
    else current.delete(id);
    setValue('assigneeIds', Array.from(current));
  };

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const task = await createMutation.mutateAsync({
        projectId,
        title: data.title,
        description: data.description ? data.description : undefined,
        dueDate: new Date(data.dueDate),
        status: data.status,
        priority: data.priority,
        assigneeIds: data.assigneeIds,
      });
      toast.success('Task created');
      router.push(`/projects/${projectId}/tasks/${task.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Create failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>New task</CardTitle>
            <CardDescription>Give it a title and a future due date.</CardDescription>
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
                <div className="space-y-2">
                  <Label>Assignees</Label>
                  <div
                    className="max-h-40 overflow-y-auto rounded-md border bg-background p-2"
                    role="group"
                    aria-label="Assignees"
                  >
                    {(assigneeQuery.data ?? []).length === 0 ? (
                      <p className="px-1 py-2 text-xs text-muted-foreground">
                        No project members available
                      </p>
                    ) : (
                      (assigneeQuery.data ?? []).map((u) => {
                        const checked = assigneeIdsValue.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-accent"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleAssignee(u.id, e.target.checked)}
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
                  <p className="text-xs text-muted-foreground">
                    {assigneeIdsValue.length === 0
                      ? 'Unassigned'
                      : `${assigneeIdsValue.length} selected`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create task'}
                </Button>
                <Link
                  href={`/projects/${projectId}/tasks`}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
