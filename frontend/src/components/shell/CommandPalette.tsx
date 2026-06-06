'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';

const MAX_RESULTS = 8;
const DEBOUNCE_MS = 200;

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the query so we don't fire a network call on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  // Reset query when palette closes so the next open starts blank.
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reactive reset: when `open` flips off, clear both query mirrors
      setQuery('');
      setDebouncedQuery('');
    }
  }, [open]);

  // Global Cmd+K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const hasQuery = debouncedQuery.length > 0;
  const projectQuery = useProjects(hasQuery ? { q: debouncedQuery, limit: MAX_RESULTS } : undefined);
  const taskQuery = useTasks(hasQuery ? { q: debouncedQuery, limit: MAX_RESULTS } : undefined);

  const projects = hasQuery ? (projectQuery.data?.data ?? []).slice(0, MAX_RESULTS) : [];
  const tasks = hasQuery ? (taskQuery.data?.data ?? []).slice(0, MAX_RESULTS) : [];
  const isLoading = hasQuery && (projectQuery.isLoading || taskQuery.isLoading);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search projects and tasks"
    >
      <Command>
      <CommandInput
        placeholder="Search projects and tasks…"
        value={query}
        onValueChange={setQuery}
        data-testid="palette-input"
      />
      <CommandList>
        {!hasQuery ? (
          <CommandEmpty>Type to search projects and tasks.</CommandEmpty>
        ) : isLoading ? (
          <CommandEmpty>Searching…</CommandEmpty>
        ) : projects.length === 0 && tasks.length === 0 ? (
          <CommandEmpty>No matches for &quot;{debouncedQuery}&quot;.</CommandEmpty>
        ) : null}

        {projects.length > 0 && (
          <CommandGroup heading="Projects">
            {projects.map((p) => (
              <CommandItem
                key={p.id}
                value={`project-${p.id}-${p.name}`}
                onSelect={() => handleSelect(`/projects/${p.id}`)}
              >
                {p.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {projects.length > 0 && tasks.length > 0 && <CommandSeparator />}

        {tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {tasks.map((t) => (
              <CommandItem
                key={t.id}
                value={`task-${t.id}-${t.title}`}
                onSelect={() => handleSelect(`/projects/${t.projectId}/tasks/${t.id}`)}
              >
                {t.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}
