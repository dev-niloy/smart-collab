'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { useProjectActivity } from '@/hooks/useActivity';

export default function ProjectActivityPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const query = useProjectActivity(id, { limit: 10 });

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Link
          href={`/projects/${id}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to project
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Activity</h1>
        <section className="mt-6 rounded-lg border p-4">
          <ActivityFeed query={query} />
        </section>
      </main>
    </div>
  );
}
