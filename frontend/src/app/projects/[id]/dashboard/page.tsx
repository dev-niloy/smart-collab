'use client';

import { useParams } from 'next/navigation';
import { DashboardGrid } from '@/app/dashboard/page';

export default function ScopedDashboardPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  return <DashboardGrid projectId={id} />;
}
