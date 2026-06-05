'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Pin, PinOff } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import type { Project } from '@/lib/schemas/project';
import { ProjectProgress } from '@/components/projects/ProjectProgress';

export const PINNED_STORAGE_KEY = 'sc:projects:pinned';

type ChipKey = 'all' | 'active' | 'mine' | 'completed';

interface Chip {
  key: ChipKey;
  label: string;
  params: { status?: string; createdBy?: string };
}

const CHIPS: Chip[] = [
  { key: 'all', label: 'All', params: {} },
  { key: 'active', label: 'Active', params: { status: 'active' } },
  { key: 'mine', label: 'Mine', params: { createdBy: 'me' } },
  { key: 'completed', label: 'Completed', params: { status: 'completed' } },
];

const STATUS_DOT: Record<Project['status'], string> = {
  active: 'bg-emerald-500',
  completed: 'bg-violet-500',
  on_hold: 'bg-amber-500',
};

function readPinnedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PINNED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function ProjectRow({
  project,
  pinned,
  onTogglePin,
}: {
  project: Project;
  pinned: boolean;
  onTogglePin: (id: string) => void;
}) {
  return (
    <div
      className={
        'group flex flex-col gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-accent' +
        (pinned && project.progress.total > 0 ? ' pb-2' : '')
      }
    >
      <div className="flex items-center gap-2">
        <Link href={`/projects/${project.id}`} className="flex min-w-0 flex-1 items-center gap-2">
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-sm ${STATUS_DOT[project.status]}`}
          />
          <span className="truncate">{project.name}</span>
        </Link>
        <button
        type="button"
        aria-label={pinned ? `Unpin ${project.name}` : `Pin ${project.name}`}
        aria-pressed={pinned}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTogglePin(project.id);
        }}
        className={
          'shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground ' +
          (pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100')
        }
      >
        {pinned ? (
          <PinOff className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Pin className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
      </div>
      {pinned ? (
        <ProjectProgress
          progress={project.progress}
          variant="inline"
          className="pl-4 pr-1"
        />
      ) : null}
    </div>
  );
}

export function ProjectsPanel() {
  const [activeChip, setActiveChip] = useState<ChipKey>('all');
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount hydration: SSR cannot read localStorage
    setPinnedIds(readPinnedIds());
  }, []);

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable; in-memory state still updates
      }
      return next;
    });
  };

  const chip = CHIPS.find((c) => c.key === activeChip) ?? CHIPS[0];
  const { data, isLoading } = useProjects({ ...chip.params, limit: 50 });

  const projects = data?.data ?? [];
  const pinned = projects.filter((p) => pinnedIds.includes(p.id));
  const rest = projects.filter((p) => !pinnedIds.includes(p.id));

  return (
    <div data-testid="projects-panel" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Projects</h2>
        <Link
          href="/projects/new"
          aria-label="New project"
          className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3 w-3" strokeWidth={2} aria-hidden />
          New
        </Link>
      </div>

      <div
        role="tablist"
        aria-label="Project filter"
        className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2"
      >
        {CHIPS.map((c) => {
          const selected = c.key === activeChip;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={selected}
              data-selected={selected ? 'true' : 'false'}
              onClick={() => setActiveChip(c.key)}
              className={
                'rounded-full px-2.5 py-0.5 text-xs ' +
                (selected
                  ? 'bg-accent text-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground')
              }
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <section aria-label="Pinned projects" className="px-2 pt-3">
          <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pinned
          </h3>
          <div className="mt-1">
            {pinned.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No pinned projects yet</p>
            ) : (
              pinned.map((p) => (
                <ProjectRow key={p.id} project={p} pinned onTogglePin={togglePin} />
              ))
            )}
          </div>
        </section>

        <section aria-label="All projects" className="px-2 pt-3">
          <h3 className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            All
          </h3>
          <div className="mt-1">
            {isLoading ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading…</p>
            ) : rest.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No projects in this filter</p>
            ) : (
              rest.map((p) => (
                <ProjectRow key={p.id} project={p} pinned={false} onTogglePin={togglePin} />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
