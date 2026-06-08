'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROJECT_STATUSES, type ProjectStatus, type Project } from '@/lib/schemas/project';
import { STATUS_LABEL } from '@/lib/project-format';
import { useUpdateProject } from '@/hooks/useProjects';
import { ApiError } from '@/lib/api';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  deadline: z.string().min(1, 'Deadline is required'),
  status: z.enum(PROJECT_STATUSES),
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

type Props = {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectEditDialog({ project, open, onOpenChange }: Props) {
  const updateMutation = useUpdateProject(project.id);
  const [submitting, setSubmitting] = useState(false);

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
      name: project.name,
      description: project.description ?? '',
      deadline: toDateInput(project.deadline),
      status: project.status,
    },
  });

  // Re-sync when dialog opens or project changes.
  useEffect(() => {
    if (open) {
      reset({
        name: project.name,
        description: project.description ?? '',
        deadline: toDateInput(project.deadline),
        status: project.status,
      });
    }
  }, [open, project, reset]);

  const statusValue = watch('status') ?? 'active';

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      await updateMutation.mutateAsync({
        name: data.name,
        description: data.description ?? '',
        deadline: new Date(data.deadline),
        status: data.status,
      });
      toast.success('Project updated');
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Update failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>
            Update name, description, deadline, or status.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" {...register('name')} />
            {errors.name && (
              <p role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" rows={4} {...register('description')} />
            {errors.description && (
              <p role="alert" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-deadline">Deadline</Label>
            <Input id="edit-deadline" type="date" {...register('deadline')} />
            {errors.deadline && (
              <p role="alert" className="text-sm text-destructive">
                {errors.deadline.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={statusValue}
              onValueChange={(v) => setValue('status', v as ProjectStatus)}
            >
              <SelectTrigger aria-label="Status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
