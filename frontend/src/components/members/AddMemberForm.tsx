'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROJECT_ROLES, type ProjectRole } from '@/lib/schemas/project-member';
import { PROJECT_ROLE_LABEL } from '@/lib/project-member-format';
import { useAddMember } from '@/hooks/useProjectMembers';
import { ApiError } from '@/lib/api';

const formSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email').max(254),
  role: z.enum(PROJECT_ROLES),
});
type FormValues = z.infer<typeof formSchema>;

export interface AddMemberFormProps {
  projectId: string;
}

export function AddMemberForm({ projectId }: AddMemberFormProps) {
  const addMutation = useAddMember(projectId);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', role: 'member' },
  });

  const roleValue = watch('role') ?? 'member';

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const role = (data.role ?? roleValue) as ProjectRole;
      await addMutation.mutateAsync({ email: data.email, role });
      toast.success(`Added ${data.email}`);
      reset({ email: '', role: 'member' });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Add failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-wrap items-end gap-2"
      noValidate
      aria-label="Add member"
    >
      <div className="grow space-y-1">
        <Label htmlFor="member-email">Email</Label>
        <Input
          id="member-email"
          type="email"
          placeholder="teammate@company.com"
          {...register('email')}
        />
        {errors.email && (
          <p role="alert" className="text-xs text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <Label>Role</Label>
        <Select
          value={roleValue}
          onValueChange={(v) => setValue('role', v as ProjectRole)}
        >
          <SelectTrigger aria-label="Role" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {PROJECT_ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add member'}
      </Button>
    </form>
  );
}
