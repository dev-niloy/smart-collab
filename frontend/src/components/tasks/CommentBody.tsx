'use client';

import { splitMentionSegments } from '@/lib/mentions';

interface CommentBodyProps {
  body: string;
  className?: string;
}

/**
 * Renders a comment body string. `@[Name](<uuid>)` tokens get chipped
 * inline with a small rounded badge; everything else is plain text and
 * preserves whitespace via `whitespace-pre-wrap`.
 *
 * The chip is intentionally inline (no avatar) for now — task assignee
 * avatars carry the same naming and there is no per-comment hover-card
 * yet. A v2 can swap in a `Tooltip` showing email + role.
 */
export function CommentBody({ body, className }: CommentBodyProps) {
  const segments = splitMentionSegments(body);
  return (
    <p className={`whitespace-pre-wrap text-sm ${className ?? ''}`.trim()}>
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span
            key={i}
            data-testid="comment-mention-chip"
            data-user-id={seg.value.userId}
            className="mx-0.5 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/20"
          >
            @{seg.value.name}
          </span>
        ),
      )}
    </p>
  );
}
