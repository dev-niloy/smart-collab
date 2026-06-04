'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { useUser } from '@/hooks/useUser';
import { MemberCard } from '@/components/members/MemberCard';
import { AddMemberForm } from '@/components/members/AddMemberForm';
import { RemoveMemberButton } from '@/components/members/RemoveMemberButton';
import { RoleSelect } from '@/components/members/RoleSelect';

export default function ProjectMembersPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id ?? '';
  const { user } = useUser();
  const { data: members, isLoading, isError, refetch } = useProjectMembers(projectId);

  const isAdmin = user?.role === 'admin';
  const isProjectPm = !!members?.some((m) => m.userId === user?.id && m.role === 'pm');
  const isPrivileged = isAdmin || isProjectPm;

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to project
        </Link>

        <div className="mt-4 mb-4 flex flex-col gap-3">
          <h1 className="text-xl font-semibold">Team members</h1>
          {isPrivileged ? (
            <Card>
              <CardContent className="py-4">
                <AddMemberForm projectId={projectId} />
              </CardContent>
            </Card>
          ) : null}
        </div>

        {isLoading ? (
          <div className="space-y-3" data-testid="members-loading">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 w-full animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : isError || !members ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-8">
              <p className="text-sm text-destructive" role="alert">
                Failed to load members.
              </p>
              <Button variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : members.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground">No members yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {members.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                actions={
                  isPrivileged ? (
                    <div
                      data-testid={`member-actions-${m.id}`}
                      className="flex items-center gap-2"
                    >
                      <RoleSelect
                        projectId={projectId}
                        memberId={m.id}
                        currentRole={m.role}
                      />
                      <RemoveMemberButton
                        projectId={projectId}
                        memberId={m.id}
                        memberName={m.user.name}
                      />
                    </div>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
