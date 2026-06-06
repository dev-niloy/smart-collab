// Helpers for serialising multi-value URL query params back and forth.
// Used by /projects + /projects/[id]/tasks pages so chips + ranges stay
// in sync with the URL (back/forward + share-link work).

export const parseCsv = (v: string | null | undefined): string[] => {
  if (!v) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of v.split(',')) {
    const s = raw.trim();
    if (s.length === 0) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
};

export const toCsv = (xs: readonly string[]): string => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const s = x.trim();
    if (s.length === 0) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.join(',');
};

// ISO date string (YYYY-MM-DD or full ISO) → keep as string when valid,
// else undefined. We don't convert to Date here because URL state and
// <input type="date"> both want strings.
export const parseDateParam = (v: string | null | undefined): string | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return v;
};
