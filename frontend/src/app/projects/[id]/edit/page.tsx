'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Header } from '@/components/header';
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
import { PROJECT_STATUSES, type ProjectStatus } from '@/lib/schemas/project';
import { STATUS_LABEL } from '@/lib/project-format';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { useRole } from '@/hooks/useUser';
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

export default function EditProjectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { role, isLoading: roleLoading } = useRole();
  const canMutate = role === 'admin' || role === 'project_manager';
  const { data: project, isLoading: projectLoading, isError } = useProject(id);
  const updateMutation = useUpdateProject(id);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!roleLoading && role && !canMutate) {
      router.replace('/forbidden');
    }
  }, [roleLoading, role, canMutate, router]);

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
    if (project) {
      reset({
        name: project.name,
        description: project.description ?? '',
        deadline: toDateInput(project.deadline),
        status: project.status,
      });
    }
  }, [project, reset]);

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
      router.push(`/projects/${id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Update failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (roleLoading || (role && !canMutate)) {
    return (
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          <p className="text-sm text-muted-foreground">Checking permissions…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        {projectLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">Loading project…</p>
            </CardContent>
          </Card>
        ) : isError || !project ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">Project not found.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Edit project</CardTitle>
              <CardDescription>Update name, description, deadline, or status.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" {...register('name')} />
                  {errors.name && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.name.message}
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
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline</Label>
                  <Input id="deadline" type="date" {...register('deadline')} />
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
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Link
                    href={`/projects/${id}`}
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
