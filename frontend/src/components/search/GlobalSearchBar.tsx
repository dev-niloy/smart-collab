'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import type { ProjectHit, TaskHit } from '@/lib/schemas/search';

const DEBOUNCE_MS = 200;

type HitGroupProps = {
  label: string;
  hits: Array<{ id: string; primary: string; sub?: string; href: string }>;
  onPick: () => void;
};

const HitGroup = ({ label, hits, onPick }: HitGroupProps) => {
  if (hits.length === 0) return null;
  return (
    <div className="px-2 py-1">
      <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <ul className="space-y-0.5">
        {hits.map((h) => (
          <li key={h.id}>
            <Link
              href={h.href}
              onClick={onPick}
              className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            >
              <span className="block truncate font-medium">{h.primary}</span>
              {h.sub ? (
                <span className="block truncate text-xs text-muted-foreground">{h.sub}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export function GlobalSearchBar() {
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce raw → q so we don't fire a request on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQ(raw), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [raw]);

  // "/" keyboard shortcut focuses the input from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          (t as HTMLElement).isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Click-outside closes the popover.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, []);

  const search = useGlobalSearch(q, 5);

  const projectHits = (search.data?.projects ?? []).map((p: ProjectHit) => ({
    id: p.id,
    primary: p.name,
    sub: p.description ?? undefined,
    href: `/projects/${p.id}`,
  }));
  const taskHits = (search.data?.tasks ?? []).map((t: TaskHit) => ({
    id: t.id,
    primary: t.title,
    sub: `in ${t.projectName}`,
    href: `/projects/${t.projectId}/tasks/${t.id}`,
  }));

  const onPick = () => {
    setOpen(false);
    setRaw('');
    setQ('');
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const first = projectHits[0] ?? taskHits[0];
    if (first) {
      router.push(first.href);
      onPick();
    }
  };

  const showResults = open && q.trim().length >= 2;
  const showLoading = showResults && search.isPending;
  const showEmpty =
    showResults && search.isSuccess && projectHits.length === 0 && taskHits.length === 0;

  return (
    <div ref={containerRef} className="relative w-72" role="search">
      <form onSubmit={onSubmit}>
        <input
          ref={inputRef}
          type="search"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search projects & tasks  ( / )"
          aria-label="Search projects and tasks"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>

      {showResults ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-md border bg-popover shadow-lg"
          role="listbox"
        >
          {showLoading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground" role="status">
              Searching…
            </div>
          ) : null}
          {showEmpty ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matches for “{q}”.
            </div>
          ) : null}
          {search.isSuccess && !showEmpty ? (
            <>
              <HitGroup label="Projects" hits={projectHits} onPick={onPick} />
              <HitGroup label="Tasks" hits={taskHits} onPick={onPick} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default GlobalSearchBar;
