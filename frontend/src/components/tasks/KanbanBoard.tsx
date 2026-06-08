'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { TaskAssigneesAvatars } from '@/components/tasks/TaskAssigneesAvatars';
import { updateTask } from '@/lib/tasks';
import { PROJECTS_KEY, projectKey } from '@/hooks/useProjects';
import { TASKS_KEY, taskKey } from '@/hooks/useTasks';
import {
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  STATUS_LABEL,
  fmtDate,
} from '@/lib/task-format';
import { TASK_STATUSES, type Task, type TaskStatus } from '@/lib/schemas/task';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

type Props = {
  tasks: Task[];
  projectId: string;
  canWriteFor: (t: Task) => boolean;
};

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  todo: '#62666d',
  in_progress: '#828fff',
  completed: '#27a644',
};
const DASHBOARD_KEY = ['dashboard'] as const;

export function KanbanBoard({ tasks, projectId, canWriteFor }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const qc = useQueryClient();

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      updateTask(id, { status }),
    onSuccess: (task) => {
      qc.setQueryData(taskKey(task.id), task);
      void qc.invalidateQueries({ queryKey: TASKS_KEY });
      void qc.invalidateQueries({ queryKey: PROJECTS_KEY });
      void qc.invalidateQueries({ queryKey: projectKey(projectId) });
      void qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiError ? err.message : 'Failed to move task';
      toast.error(msg);
    },
  });

  const byStatus = useMemo(() => {
    const buckets: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      completed: [],
    };
    for (const t of tasks) buckets[t.status]?.push(t);
    return buckets;
  }, [tasks]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

  const onStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };
  const onEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const draggedId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const task = tasks.find((t) => t.id === draggedId);
    if (!task) return;
    const next = overId as TaskStatus;
    if (!(TASK_STATUSES as readonly string[]).includes(next)) return;
    if (task.status === next) return;
    if (!canWriteFor(task)) {
      toast.error('You can’t move this task');
      return;
    }
    moveMutation.mutate({ id: task.id, status: next });
  };

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {TASK_STATUSES.map((s) => (
          <KanbanColumn
            key={s}
            status={s}
            tasks={byStatus[s] ?? []}
            projectId={projectId}
            canWriteFor={canWriteFor}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} projectId={projectId} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  tasks,
  projectId,
  canWriteFor,
}: {
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
  canWriteFor: (t: Task) => boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const accent = COLUMN_ACCENT[status];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[140px] flex-col gap-2 rounded-lg border bg-card/40 p-3 transition-colors',
        isOver ? 'border-primary/60 bg-card/70' : 'border-border/60',
      )}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: accent }} />
          <span className="text-[12.5px] font-medium tracking-tight">
            {STATUS_LABEL[status]}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">{tasks.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-[12px] text-muted-foreground">
            Drop tasks here
          </div>
        ) : (
          tasks.map((t) => (
            <DraggableTask key={t.id} task={t} projectId={projectId} canWrite={canWriteFor(t)} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableTask({
  task,
  projectId,
  canWrite,
}: {
  task: Task;
  projectId: string;
  canWrite: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !canWrite,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab touch-none rounded-md border border-border/60 bg-background p-3 text-left shadow-sm transition-shadow hover:border-border',
        !canWrite && 'cursor-default opacity-90',
        isDragging && 'opacity-30',
      )}
    >
      <TaskCard task={task} projectId={projectId} />
    </div>
  );
}

function TaskCard({
  task,
  projectId,
  dragging,
}: {
  task: Task;
  projectId: string;
  dragging?: boolean;
}) {
  const assigneeUsers = task.assignees.map((a) => a.user);
  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        dragging && 'rounded-md border border-primary/60 bg-card p-3 shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/projects/${projectId}/tasks/${task.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[13.5px] font-medium tracking-tight hover:underline"
        >
          {task.title}
        </Link>
        <Badge variant={PRIORITY_VARIANT[task.priority]}>
          {PRIORITY_LABEL[task.priority]}
        </Badge>
      </div>
      <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
        <span>Due {fmtDate(task.dueDate)}</span>
        <TaskAssigneesAvatars users={assigneeUsers} />
      </div>
    </div>
  );
}
