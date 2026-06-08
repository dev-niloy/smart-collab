'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROJECT_STATUSES, type ProjectStatus } from '@/lib/schemas/project';
import { STATUS_LABEL } from '@/lib/project-format';
import { useCreateProject } from '@/hooks/useProjects';
import { ApiError } from '@/lib/api';

const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  deadline: z.string().min(1, 'Deadline is required'),
  status: z.enum(PROJECT_STATUSES),
});
type FormValues = z.infer<typeof formSchema>;

export interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const router = useRouter();
  const createMutation = useCreateProject();
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
    defaultValues: { name: '', description: '', deadline: '', status: 'active' },
  });

  useEffect(() => {
    if (!open) {
      reset({ name: '', description: '', deadline: '', status: 'active' });
    }
  }, [open, reset]);

  const statusValue = watch('status') ?? 'active';

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const project = await createMutation.mutateAsync({
        name: data.name,
        description: data.description ? data.description : undefined,
        deadline: new Date(data.deadline),
        status: data.status,
      });
      toast.success('Project created');
      onOpenChange(false);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Give it a name and a future deadline.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="new-project-name" className="text-xs font-medium text-muted-foreground">Name</Label>
            <Input id="new-project-name" placeholder="Project name" autoFocus {...register('name')} />
            {errors.name && (
              <p role="alert" className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-project-description" className="text-xs font-medium text-muted-foreground">Description</Label>
            <Textarea id="new-project-description" rows={4} placeholder="What is this project about?" {...register('description')} />
            {errors.description && (
              <p role="alert" className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-project-deadline" className="text-xs font-medium text-muted-foreground">Deadline</Label>
              <Input id="new-project-deadline" type="date" {...register('deadline')} />
              {errors.deadline && (
                <p role="alert" className="text-xs text-destructive">{errors.deadline.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
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
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
