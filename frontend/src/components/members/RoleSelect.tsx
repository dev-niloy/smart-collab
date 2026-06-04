'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROJECT_ROLES, type ProjectRole } from '@/lib/schemas/project-member';
import { PROJECT_ROLE_LABEL } from '@/lib/project-member-format';
import { useUpdateMemberRole } from '@/hooks/useProjectMembers';
import { ApiError } from '@/lib/api';

type Props = {
  projectId: string;
  memberId: string;
  currentRole: ProjectRole;
};

export function RoleSelect({ projectId, memberId, currentRole }: Props) {
  const updateMutation = useUpdateMemberRole(projectId);
  const [pending, setPending] = useState(false);

  const onChange = async (value: ProjectRole) => {
    if (value === currentRole) return;
    setPending(true);
    try {
      await updateMutation.mutateAsync({ memberId, input: { role: value } });
      toast.success(`Role updated to ${PROJECT_ROLE_LABEL[value]}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Update failed';
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  return (
    <Select
      value={currentRole}
      onValueChange={(v) => onChange(v as ProjectRole)}
      disabled={pending}
    >
      <SelectTrigger aria-label="Role" className="h-8 w-32 text-xs">
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
  );
}
