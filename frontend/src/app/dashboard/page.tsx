'use client';

import Link from 'next/link';
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
          <Link href="/projects" className="block">
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardTitle>Projects</CardTitle>
                <CardDescription>Browse, create, and manage projects.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Open →</CardContent>
            </Card>
          </Link>
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>Open tasks across all projects.</CardDescription>
            </CardHeader>
            <CardContent
              className="text-3xl font-semibold"
              aria-label="No data yet"
            >
              <span aria-hidden="true">—</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>Members across projects.</CardDescription>
            </CardHeader>
            <CardContent
              className="text-3xl font-semibold"
              aria-label="No data yet"
            >
              <span aria-hidden="true">—</span>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          Foundation shell. Real KPIs and charts land in the dashboard-analytics subgoal.
        </p>
      </main>
    </div>
  );
}
