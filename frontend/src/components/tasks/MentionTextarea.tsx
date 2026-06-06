'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { cn } from '@/lib/utils';
import { useAssignableMembers } from '@/hooks/useProjectMembers';
import { splitMentionSegments } from '@/lib/mentions';
import type { AssignableMember } from '@/lib/schemas/project-member';

type Props = {
  value: string;
  onChange: (next: string) => void;
  projectId: string;
  placeholder?: string;
  maxLength?: number;
  'aria-label'?: string;
  /** Max members shown in the popover list (default 8). */
  maxResults?: number;
};

type PopoverState =
  | { open: false }
  | { open: true; query: string; highlighted: number };

const initialState: PopoverState = { open: false };

const EDITOR_CLASSES =
  'flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none whitespace-pre-wrap break-words placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground';

const CHIP_CLASS =
  'inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/20 mx-0.5';

const buildChipNode = (name: string, userId: string): HTMLSpanElement => {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset.mentionName = name;
  chip.dataset.mentionUserId = userId;
  chip.className = CHIP_CLASS;
  chip.setAttribute('data-testid', 'comment-mention-chip');
  chip.textContent = `@${name}`;
  return chip;
};

const renderValueToDOM = (root: HTMLElement, value: string): void => {
  root.textContent = '';
  const segments = splitMentionSegments(value);
  for (const seg of segments) {
    if (seg.kind === 'text') {
      const lines = seg.value.split('\n');
      lines.forEach((line, i) => {
        if (line.length > 0) root.appendChild(document.createTextNode(line));
        if (i < lines.length - 1) root.appendChild(document.createElement('br'));
      });
    } else {
      root.appendChild(buildChipNode(seg.value.name, seg.value.userId));
    }
  }
};

const serializeDOM = (root: HTMLElement): string => {
  let out = '';
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    if (node instanceof HTMLElement) {
      if (node.dataset.mentionUserId) {
        const name = node.dataset.mentionName ?? '';
        out += `@[${name}](${node.dataset.mentionUserId})`;
        return;
      }
      if (node.tagName === 'BR') {
        out += '\n';
        return;
      }
      for (const child of Array.from(node.childNodes)) walk(child);
    }
  };
  for (const child of Array.from(root.childNodes)) walk(child);
  return out;
};

/**
 * Walks backwards from `caret` looking for an `@` that opens a mention
 * query. The `@` must sit at start-of-string or after whitespace; the
 * span between `@` and the caret must contain no whitespace. Returns the
 * query slice, or null if we are NOT in a mention context.
 */
const detectMentionContextFromText = (textBeforeCaret: string): { query: string } | null => {
  for (let i = textBeforeCaret.length - 1; i >= 0; i--) {
    const ch = textBeforeCaret[i];
    if (ch === '@') {
      const prev = i > 0 ? textBeforeCaret[i - 1] : '';
      if (prev === '' || /\s/.test(prev)) {
        const query = textBeforeCaret.slice(i + 1);
        if (!/\s/.test(query)) return { query };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
  }
  return null;
};

const textBeforeSelection = (root: HTMLElement): string | null => {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(root);
  try {
    pre.setEnd(range.endContainer, range.endOffset);
  } catch {
    return null;
  }
  return pre.toString();
};

/**
 * Extend the current selection backward by `n` characters so it covers
 * the `@query` text we are about to replace with a chip.
 *
 * Prefers the standard `Selection.modify` (Chromium/Firefox/Safari);
 * falls back to a manual `setStart` on the current text node, which is
 * what jsdom-driven tests exercise.
 */
const extendSelectionBackward = (n: number): void => {
  const sel = window.getSelection();
  if (!sel) return;
  const modify = (sel as Selection & { modify?: (alter: string, dir: string, unit: string) => void })
    .modify;
  if (typeof modify === 'function') {
    for (let i = 0; i < n; i++) modify.call(sel, 'extend', 'backward', 'character');
    return;
  }
  if (sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (range.endContainer.nodeType === Node.TEXT_NODE) {
    const newStart = Math.max(0, range.endOffset - n);
    range.setStart(range.endContainer, newStart);
  }
};

export function MentionTextarea({
  value,
  onChange,
  projectId,
  placeholder,
  maxLength,
  maxResults = 8,
  'aria-label': ariaLabel,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef(value);
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

  const highlighted =
    state.open && filtered.length > 0
      ? Math.min(state.highlighted, filtered.length - 1)
      : 0;

  // Sync DOM from `value` whenever it changes EXTERNALLY (parent reset
  // to '' after submit). If the value matches what we last emitted from
  // our own onInput, do nothing — that would clobber the caret.
  useEffect(() => {
    if (!ref.current) return;
    if (lastEmitted.current === value) return;
    renderValueToDOM(ref.current, value);
    lastEmitted.current = value;
  }, [value]);

  // Initial mount render.
  useEffect(() => {
    if (ref.current && ref.current.childNodes.length === 0 && value.length > 0) {
      renderValueToDOM(ref.current, value);
      lastEmitted.current = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closePopover = useCallback(() => setState(initialState), []);

  const emit = useCallback(() => {
    if (!ref.current) return;
    const wire = serializeDOM(ref.current);
    lastEmitted.current = wire;
    onChange(wire);
  }, [onChange]);

  const updatePopoverFromCaret = useCallback(() => {
    if (!ref.current) return;
    const before = textBeforeSelection(ref.current);
    if (before === null) {
      closePopover();
      return;
    }
    const ctx = detectMentionContextFromText(before);
    if (ctx) {
      setState((prev) =>
        prev.open ? { ...prev, query: ctx.query } : { open: true, query: ctx.query, highlighted: 0 },
      );
    } else {
      closePopover();
    }
  }, [closePopover]);

  const insertMention = useCallback(
    (member: AssignableMember) => {
      if (!ref.current) return;
      if (!state.open) return;
      const before = textBeforeSelection(ref.current);
      if (before === null) return;
      const ctx = detectMentionContextFromText(before);
      if (!ctx) return;
      // Extend selection back over `@query` so deleteFromDocument removes it.
      extendSelectionBackward(ctx.query.length + 1);
      const sel = window.getSelection();
      if (!sel) return;
      sel.deleteFromDocument();
      const range = sel.getRangeAt(0);
      const chip = buildChipNode(member.name, member.id);
      const space = document.createTextNode(' ');
      // Insert chip first so range.insertNode places it AT caret; then
      // the space immediately after.
      range.insertNode(chip);
      range.setStartAfter(chip);
      range.collapse(true);
      range.insertNode(space);
      range.setStartAfter(space);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      closePopover();
      emit();
    },
    [state.open, closePopover, emit],
  );

  const handleInput = () => {
    emit();
    updatePopoverFromCaret();
  };

  const handleKeyUp = () => {
    // Caret may have moved without changing content (arrow keys).
    updatePopoverFromCaret();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (state.open && filtered.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setState({
          ...state,
          highlighted: (highlighted + 1) % filtered.length,
        });
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
  };

  const handleBlur = () => {
    // Defer so a popover click can run first.
    setTimeout(() => closePopover(), 100);
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={state.open && filtered.length > 0 ? listboxId : undefined}
        aria-expanded={state.open && filtered.length > 0}
        aria-label={ariaLabel}
        data-placeholder={placeholder}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={handleBlur}
        className={cn(EDITOR_CLASSES)}
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
      {maxLength !== undefined ? (
        // Soft cap surfaced via the parent's character counter. Hard cap is
        // enforced server-side; this hint guides users locally.
        <span className="sr-only">Max {maxLength} characters.</span>
      ) : null}
    </div>
  );
}
