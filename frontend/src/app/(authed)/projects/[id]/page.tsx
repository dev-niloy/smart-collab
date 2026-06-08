'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useProject } from '@/hooks/useProjects';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useRole } from '@/hooks/useUser';
import { DeleteProjectButton } from '@/components/projects/delete-project-button';
import { ProjectProgress } from '@/components/projects/ProjectProgress';
import { ProjectMembersDialog } from '@/components/projects/ProjectMembersDialog';
import { ProjectActivityDialog } from '@/components/projects/ProjectActivityDialog';
import { ApiError } from '@/lib/api';
import { STATUS_LABEL, STATUS_VARIANT, fmtDate, fmtDateTime } from '@/lib/project-format';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { role } = useRole();
  const canMutate = role === 'admin' || role === 'project_manager';
  const { data: project, isLoading, isError, error, refetch } = useProject(id);
  const { data: members } = useProjectMembers(id);
  const memberCount = members?.length;
  const isForbidden = error instanceof ApiError && error.status === 403;
  const [membersOpen, setMembersOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <main className="w-full flex-1 px-8 py-10">

        {isLoading ? (
          <Card className="mt-4">
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">Loading project…</p>
            </CardContent>
          </Card>
        ) : isForbidden ? (
          <Card className="mt-4">
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <p className="text-sm font-medium" role="alert">
                You do not have access to this project.
              </p>
              <p className="text-sm text-muted-foreground">
                Ask an admin or project manager to add you as a member.
              </p>
              <Link href="/projects">
                <Button variant="outline">Back to projects</Button>
              </Link>
            </CardContent>
          </Card>
        ) : isError || !project ? (
          <Card className="mt-4">
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <p className="text-sm text-destructive" role="alert">
                Project not found or failed to load.
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-4">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                <span className="text-eyebrow">Project</span>
                <CardTitle className="text-display-md">{project.name}</CardTitle>
                <CardDescription className="text-xs">
                  Created by {project.creator.name} · {project.creator.email}
                </CardDescription>
              </div>
              <Badge variant={STATUS_VARIANT[project.status]}>
                {STATUS_LABEL[project.status]}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.description ? (
                <p className="whitespace-pre-wrap text-sm">{project.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description.</p>
              )}

              <ProjectProgress progress={project.progress} variant="detail" />

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Deadline</dt>
                  <dd>{fmtDate(project.deadline)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd>{STATUS_LABEL[project.status]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd>{fmtDateTime(project.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Updated</dt>
                  <dd>{fmtDateTime(project.updatedAt)}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2 pt-2">
                <Link href={`/projects/${project.id}/tasks`}>
                  <Button variant="secondary">View tasks →</Button>
                </Link>
                <Button variant="secondary" onClick={() => setMembersOpen(true)}>
                  Members{typeof memberCount === 'number' ? ` (${memberCount})` : ''}
                </Button>
                <Link href={`/projects/${project.id}/dashboard`}>
                  <Button variant="secondary">Dashboard →</Button>
                </Link>
                <Button variant="secondary" onClick={() => setActivityOpen(true)}>
                  Activity
                </Button>
              </div>

              <ProjectMembersDialog
                projectId={project.id}
                open={membersOpen}
                onOpenChange={setMembersOpen}
              />
              <ProjectActivityDialog
                projectId={project.id}
                open={activityOpen}
                onOpenChange={setActivityOpen}
              />

              {canMutate ? (
                <div className="flex gap-2 pt-2">
                  <Link href={`/projects/${project.id}/edit`}>
                    <Button variant="outline">Edit</Button>
                  </Link>
                  <DeleteProjectButton projectId={project.id} projectName={project.name} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
