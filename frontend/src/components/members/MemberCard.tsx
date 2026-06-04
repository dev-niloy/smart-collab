'use client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ProjectMember } from '@/lib/schemas/project-member';
import {
  PROJECT_ROLE_LABEL,
  PROJECT_ROLE_VARIANT,
  workloadTone,
  activeWorkloadCount,
} from '@/lib/project-member-format';

const SYSTEM_ROLE_LABEL: Record<ProjectMember['user']['role'], string> = {
  admin: 'Admin',
  project_manager: 'PM',
  team_member: 'Member',
};

export interface MemberCardProps {
  member: ProjectMember;
  actions?: React.ReactNode;
}

export function MemberCard({ member, actions }: MemberCardProps) {
  const active = activeWorkloadCount(member.workload);
  return (
    <Card data-testid={`member-card-${member.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{member.user.name}</CardTitle>
          <CardDescription className="text-xs">{member.user.email}</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={PROJECT_ROLE_VARIANT[member.role]}>
            {PROJECT_ROLE_LABEL[member.role]}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {SYSTEM_ROLE_LABEL[member.user.role]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Todo</dt>
            <dd>{member.workload.todo}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">In Progress</dt>
            <dd>{member.workload.in_progress}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Completed</dt>
            <dd>{member.workload.completed}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Due soon</dt>
            <dd>{member.workload.due_soon}</dd>
          </div>
        </dl>
        <div className="flex items-center justify-between gap-3">
          <Badge variant={workloadTone(member.workload)} className="text-[11px]">
            {active} active
          </Badge>
          {actions ? <div className="flex gap-2">{actions}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
