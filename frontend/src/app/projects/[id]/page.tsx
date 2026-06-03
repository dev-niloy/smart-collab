'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
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
import { useRole } from '@/hooks/useUser';
import { DeleteProjectButton } from '@/components/projects/delete-project-button';
import type { ProjectStatus } from '@/lib/schemas/project';

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On hold',
};

const STATUS_VARIANT: Record<ProjectStatus, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  completed: 'secondary',
  on_hold: 'outline',
};

const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

const fmtDateTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { role } = useRole();
  const canMutate = role === 'admin' || role === 'project_manager';
  const { data: project, isLoading, isError, refetch } = useProject(id);

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Link
          href="/projects"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to projects
        </Link>

        {isLoading ? (
          <Card className="mt-4">
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">Loading project…</p>
            </CardContent>
          </Card>
        ) : isError || !project ? (
          <Card className="mt-4">
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <p className="text-sm text-muted-foreground">Project not found or failed to load.</p>
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-4">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl">{project.name}</CardTitle>
                <CardDescription>
                  Created by {project.creator.name} ({project.creator.email})
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
