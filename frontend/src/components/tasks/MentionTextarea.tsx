'use client';

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { useAssignableMembers } from '@/hooks/useProjectMembers';
import { formatMentionToken } from '@/lib/mentions';
import type { AssignableMember } from '@/lib/schemas/project-member';

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  value: string;
  onChange: (next: string) => void;
  projectId: string;
  /** Max members shown in the popover list (default 8). */
  maxResults?: number;
};

type PopoverState =
  | { open: false }
  | { open: true; query: string; atIdx: number; highlighted: number };

const initialState: PopoverState = { open: false };

const TEXTAREA_CLASSES =
  'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40';

/**
 * Walks backwards from `caret` looking for an `@` that opens a mention
 * query. The `@` must sit at start-of-string or after whitespace; the
 * span between `@` and the caret must contain no whitespace. Returns the
 * index of the `@` plus the query slice, or null if we are NOT in a
 * mention context.
 */
function detectMentionContext(
  text: string,
  caret: number,
): { atIdx: number; query: string } | null {
  for (let i = caret - 1; i >= 0; i--) {
    const ch = text[i];
    if (ch === '@') {
      const prev = i > 0 ? text[i - 1] : '';
      if (prev === '' || /\s/.test(prev)) {
        const query = text.slice(i + 1, caret);
        if (!/\s/.test(query)) return { atIdx: i, query };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
}

export function MentionTextarea({
  value,
  onChange,
  projectId,
  maxResults = 8,
  className,
  onKeyDown,
  ...textareaProps
}: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [state, setState] = useState<PopoverState>(initialState);
  const listboxId = useId();
  const assignable = useAssignableMembers(projectId);

  const filtered = useMemo<AssignableMember[]>(() => {
    if (!state.open || !assignable.data) return [];
    const q = state.query.trim().toLowerCase();
    const rows = assignable.data.filter((m) => {
      if (!q) return true;
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });
    return rows.slice(0, maxResults);
  }, [assignable.data, state, maxResults]);

  // Clamp the highlighted index at render time — the filtered list can
  // shrink between keystrokes and we never want `filtered[hi]` to be
  // undefined when Enter fires.
  const highlighted =
    state.open && filtered.length > 0
      ? Math.min(state.highlighted, filtered.length - 1)
      : 0;

  const closePopover = useCallback(() => setState(initialState), []);

  const insertMention = useCallback(
    (member: AssignableMember) => {
      const ta = ref.current;
      if (!ta) return;
      if (!state.open) return;
      const caret = ta.selectionStart;
      const before = value.slice(0, state.atIdx);
      const after = value.slice(caret);
      const token = `${formatMentionToken(member.name, member.id)} `;
      const next = `${before}${token}${after}`;
      onChange(next);
      closePopover();
      requestAnimationFrame(() => {
        const pos = before.length + token.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      });
    },
    [state, value, onChange, closePopover],
  );

  const updateMentionStateFromCaret = useCallback(
    (text: string, caret: number) => {
      const ctx = detectMentionContext(text, caret);
      if (ctx) {
        setState((prev) =>
          prev.open && prev.atIdx === ctx.atIdx
            ? { ...prev, query: ctx.query }
            : { open: true, query: ctx.query, atIdx: ctx.atIdx, highlighted: 0 },
        );
      } else if (state.open) {
        closePopover();
      }
    },
    [state.open, closePopover],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    updateMentionStateFromCaret(e.target.value, e.target.selectionStart);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (state.open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setState({ ...state, highlighted: (highlighted + 1) % filtered.length });
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setState({
          ...state,
          highlighted: (highlighted - 1 + filtered.length) % filtered.length,
        });
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        insertMention(filtered[highlighted]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closePopover();
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={(e) => {
          // Defer so a popover click can run first.
          setTimeout(() => closePopover(), 100);
          textareaProps.onBlur?.(e);
        }}
        data-slot="textarea"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={state.open && filtered.length > 0 ? listboxId : undefined}
        aria-expanded={state.open && filtered.length > 0}
        className={cn(TEXTAREA_CLASSES, className)}
        {...textareaProps}
      />
      {state.open && filtered.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Mention a project member"
          data-testid="mention-popover"
          className="absolute left-0 top-full z-50 mt-1 max-h-60 w-72 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {filtered.map((m, i) => {
            const active = i === highlighted;
            return (
              <li
                key={m.id}
                role="option"
                aria-selected={active}
                data-testid={`mention-option-${m.id}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
                className={cn(
                  'flex cursor-pointer flex-col rounded px-2 py-1.5 text-sm',
                  active ? 'bg-accent text-foreground' : 'text-foreground hover:bg-accent/50',
                )}
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">{m.email}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
