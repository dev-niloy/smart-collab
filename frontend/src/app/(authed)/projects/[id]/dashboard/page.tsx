'use client';

import { useParams } from 'next/navigation';
import { DashboardGrid } from '@/components/dashboard/DashboardGrid';

export default function ScopedDashboardPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  return <DashboardGrid projectId={id} />;
}
