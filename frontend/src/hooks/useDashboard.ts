'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getKpis,
  getStatusCounts,
  getPriorityCounts,
  getProductivity,
  getUpcoming,
  getHighPriority,
} from '@/lib/dashboard';
import type {
  Kpis,
  StatusCounts,
  PriorityCounts,
  ProductivityPoint,
  UpcomingPayload,
  HighPriorityTask,
} from '@/lib/schemas/dashboard';

export type DashboardScope = string | undefined;

const scopeKey = (s: DashboardScope) => (s ? ['scope', s] : ['global']);

export const dashboardKey = (s: DashboardScope, widget: string, days?: number) =>
  days === undefined
    ? (['dashboard', ...scopeKey(s), widget] as const)
    : (['dashboard', ...scopeKey(s), widget, days] as const);

const STALE = 15_000;

export const useKpis = (projectId: DashboardScope) =>
  useQuery<Kpis>({
    queryKey: dashboardKey(projectId, 'kpis'),
    queryFn: () => getKpis(projectId),
    staleTime: STALE,
  });

export const useStatusCounts = (projectId: DashboardScope) =>
  useQuery<StatusCounts>({
    queryKey: dashboardKey(projectId, 'status'),
    queryFn: () => getStatusCounts(projectId),
    staleTime: STALE,
  });

export const usePriorityCounts = (projectId: DashboardScope) =>
  useQuery<PriorityCounts>({
    queryKey: dashboardKey(projectId, 'priority'),
    queryFn: () => getPriorityCounts(projectId),
    staleTime: STALE,
  });

export const useProductivity = (projectId: DashboardScope, days = 30) =>
  useQuery<ProductivityPoint[]>({
    queryKey: dashboardKey(projectId, 'productivity', days),
    queryFn: () => getProductivity(projectId, days),
    staleTime: STALE,
  });

export const useUpcoming = (projectId: DashboardScope, days = 7) =>
  useQuery<UpcomingPayload>({
    queryKey: dashboardKey(projectId, 'upcoming', days),
    queryFn: () => getUpcoming(projectId, days),
    staleTime: STALE,
  });

export const useHighPriority = (projectId: DashboardScope) =>
  useQuery<HighPriorityTask[]>({
    queryKey: dashboardKey(projectId, 'high-priority'),
    queryFn: () => getHighPriority(projectId),
    staleTime: STALE,
  });
