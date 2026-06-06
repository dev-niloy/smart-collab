/**
 * Mention parser for comment bodies.
 *
 * Token format: `@[Name](<uuid-v4>)`. The label inside the square brackets is
 * arbitrary (so it can carry display names with spaces), but the parenthesized
 * id MUST be a strict 8-4-4-4-12 lowercase-hex UUID — partial / malformed
 * UUIDs are silently dropped so a body like `@[email](abc)` never counts as
 * a mention.
 *
 * The parser does NOT enforce the per-comment cap. The service layer reads
 * `MAX_MENTIONS_PER_COMMENT` and raises `TOO_MANY_MENTIONS` before opening
 * the transaction.
 */

export const MAX_MENTIONS_PER_COMMENT = 20;

// Strict v4 — UUID variant + version bits we still loosen to any hex digit
// because the existing seed + admin paths emit UUIDs that vary on those bits.
// What we DO require: lowercase hex + 8-4-4-4-12 hyphen layout.
const MENTION_RE = /@\[[^\]]+\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/g;

/**
 * Extract deduplicated mentioned userIds in first-occurrence order.
 */
export function parseMentions(body: string): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  // Reset lastIndex defensively — the regex is module-scoped + global.
  MENTION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(body)) !== null) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
