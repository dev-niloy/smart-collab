'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mail, UserPlus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROJECT_ROLES, type ProjectRole } from '@/lib/schemas/project-member';
import { PROJECT_ROLE_LABEL } from '@/lib/project-member-format';
import { useAddMember } from '@/hooks/useProjectMembers';
import { useUserSearch } from '@/hooks/useUserSearch';
import { useCreateInvitation } from '@/hooks/useInvitations';
import { ApiError } from '@/lib/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AddMemberFormProps {
  projectId: string;
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

export function AddMemberForm({ projectId }: AddMemberFormProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [role, setRole] = useState<ProjectRole>('member');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const addMutation = useAddMember(projectId);
  const inviteMutation = useCreateInvitation(projectId);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Close suggestion list when clicking outside the input/dropdown.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const searchQuery = useUserSearch(debouncedQuery, {
    excludeProjectId: projectId,
    enabled: debouncedQuery.length >= 1,
  });
  const suggestions = searchQuery.data ?? [];
  const isValidEmail = EMAIL_RE.test(query.trim());
  const exactMatch = suggestions.find(
    (u) => u.email.toLowerCase() === query.trim().toLowerCase(),
  );

  const reset = () => {
    setQuery('');
    setDebouncedQuery('');
    setRole('member');
    setFocused(false);
  };

  const onAddExisting = async (email: string) => {
    setBusy(true);
    try {
      await addMutation.mutateAsync({ email, role });
      toast.success(`Added ${email}`);
      reset();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const onInvite = async () => {
    if (!isValidEmail) {
      toast.error('Enter a valid email to invite.');
      return;
    }
    setBusy(true);
    try {
      await inviteMutation.mutateAsync({ email: query.trim().toLowerCase(), role });
      toast.success(`Invitation sent to ${query.trim()}`);
      reset();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Invite failed');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (exactMatch) {
      await onAddExisting(exactMatch.email);
      return;
    }
    if (isValidEmail) {
      await onInvite();
    }
  };

  const showDropdown =
    focused && debouncedQuery.length > 0 && (suggestions.length > 0 || isValidEmail);

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3"
      noValidate
      aria-label="Add or invite member"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div ref={rootRef} className="relative grow space-y-1.5 min-w-[260px]">
          <Label htmlFor="member-email" className="text-xs font-medium text-muted-foreground">
            Email or name
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="member-email"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search teammates or paste an email…"
              value={query}
              onFocus={() => setFocused(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocused(true);
              }}
              className="pl-9"
            />
          </div>

          {showDropdown ? (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-popover shadow-lg surface-edge-highlight"
            >
              {searchQuery.isLoading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
              ) : suggestions.length > 0 ? (
                <ul className="divide-y divide-border">
                  {suggestions.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onClick={() => onAddExisting(u.email)}
                        disabled={busy}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {u.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span>{initials(u.name)}</span>
                          )}
                        </span>
                        <span className="min-w-0 grow">
                          <span className="block truncate text-sm text-foreground">{u.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{u.email}</span>
                        </span>
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                          Add →
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {suggestions.length === 0 && !searchQuery.isLoading ? (
                <div className="px-3 py-3 text-xs text-muted-foreground">
                  No matching teammates.
                </div>
              ) : null}

              {isValidEmail && !exactMatch ? (
                <div className="border-t border-border bg-card/60 px-3 py-2">
                  <button
                    type="button"
                    onClick={onInvite}
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-accent focus:bg-accent focus:outline-none"
                  >
                    <Mail className="h-4 w-4 text-primary" aria-hidden />
                    <span className="grow">
                      <span className="block text-sm text-foreground">Invite {query.trim()}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        Send an email invitation. They'll join after accepting.
                      </span>
                    </span>
                    <UserPlus className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
            <SelectTrigger aria-label="Role" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {PROJECT_ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="submit"
          disabled={busy || (!exactMatch && !isValidEmail)}
        >
          {busy
            ? exactMatch
              ? 'Adding…'
              : 'Sending…'
            : exactMatch
              ? 'Add member'
              : isValidEmail
                ? 'Send invite'
                : 'Add member'}
        </Button>
      </div>
    </form>
  );
}
