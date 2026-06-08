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
      <main className="w-full flex-1 px-8 py-10">
        <div className="border-b border-border pb-6">
          <span className="text-eyebrow">Project · Activity</span>
          <h1 className="mt-2 text-display-md">Activity</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Recent events across this project.</p>
        </div>
        <section className="mt-6 rounded-lg border border-border bg-card surface-edge-highlight p-5">
          <ActivityFeed query={query} />
        </section>
      </main>
    </div>
  );
}
