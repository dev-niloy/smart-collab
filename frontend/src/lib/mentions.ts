/**
 * Mention token format mirror of the backend regex in
 * `backend/src/app/modules/comment/comment.mentions.ts`.
 *
 * Token: `@[Name](<uuid-v4>)`. Used by:
 *  - `CommentBody.tsx` to chip the rendered body
 *  - `TaskCommentsPanel.tsx` to detect the `@` keystroke + insert tokens
 */

export const MENTION_TOKEN_RE =
  /@\[([^\]]+)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export type MentionTokenMatch = {
  raw: string;
  name: string;
  userId: string;
};

export type MentionSegment =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; value: MentionTokenMatch };

/**
 * Split a comment body into text + mention segments in source order.
 * Empty bodies return one empty text segment so callers can render
 * uniformly without branching on length.
 */
export function splitMentionSegments(body: string): MentionSegment[] {
  if (!body) return [{ kind: 'text', value: '' }];
  const re = new RegExp(MENTION_TOKEN_RE.source, MENTION_TOKEN_RE.flags);
  const out: MentionSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      out.push({ kind: 'text', value: body.slice(lastIndex, match.index) });
    }
    out.push({
      kind: 'mention',
      value: { raw: match[0], name: match[1], userId: match[2] },
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    out.push({ kind: 'text', value: body.slice(lastIndex) });
  }
  return out;
}

export const formatMentionToken = (name: string, userId: string): string =>
  `@[${name}](${userId})`;
