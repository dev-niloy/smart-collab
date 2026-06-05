'use client';

import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateTask } from '@/hooks/useTasks';
import { TASK_STATUSES, type Task, type TaskStatus } from '@/lib/schemas/task';
import { STATUS_LABEL, STATUS_VARIANT } from '@/lib/task-format';
import { ApiError } from '@/lib/api';

type Props = {
  task: Task;
  canWrite?: boolean;
};

export function InlineStatusSelect({ task, canWrite = true }: Props) {
  const mutation = useUpdateTask(task.id);

  if (!canWrite) {
    return (
      <Badge
        variant={STATUS_VARIANT[task.status]}
        aria-label={`Status: ${STATUS_LABEL[task.status]} (read-only)`}
      >
        {STATUS_LABEL[task.status]}
      </Badge>
    );
  }
  return (
    <Select
      value={task.status}
      onValueChange={async (v) => {
        if (mutation.isPending || v === task.status) return;
        try {
          await mutation.mutateAsync({ status: v as TaskStatus });
        } catch (err) {
          const msg = err instanceof ApiError ? err.message : 'Update failed';
          toast.error(`"${task.title}": ${msg}`);
        }
      }}
    >
      <SelectTrigger
        className="h-7 w-32 text-xs"
        aria-label={`Status for ${task.title}`}
        disabled={mutation.isPending}
      >
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
  );
}
