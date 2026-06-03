'use client';

import { Header } from '@/components/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/hooks/useUser';

export default function DashboardPage() {
  const { user, isLoading } = useUser();

  return (
    <div className="flex flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLoading ? 'Loading…' : user ? `Signed in as ${user.email}` : 'Not signed in'}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Total active projects.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">—</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Open tasks across all projects.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">—</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>Members across projects.</CardDescription>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">—</CardContent>
          </Card>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Foundation shell. Real KPIs and charts land in the dashboard-analytics subgoal.
        </p>
      </main>
    </div>
  );
}
