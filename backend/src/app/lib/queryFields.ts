import { z } from 'zod';

// CSV → array of valid enum members. Unknown tokens silently dropped so a
// single bad value never 422s the whole request. Empty array means "no filter".
export const csvOfEnum = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v): T[] | undefined => {
      if (!v) return undefined;
      const allowed = new Set<string>(values);
      const out = v
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && allowed.has(s));
      return out.length > 0 ? (out as T[]) : undefined;
    });

// ISO date that 422s on garbage; undefined when omitted.
export const isoDateField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid ISO date' });
      return z.NEVER;
    }
    return d;
  });

// Build a Prisma equality-or-IN clause from a value that may be a single
// item, an array, or undefined. Empty arrays collapse to undefined (no filter).
export const arrayOrEq = <T>(v: T | T[] | undefined): T | { in: T[] } | undefined => {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.length === 0 ? undefined : { in: v };
  return v;
};

// Accepts either the literal 'me' (resolved server-side to the authed actor)
// or a UUID. Anything else silently drops.
export const meOrUuid = z
  .string()
  .optional()
  .transform((v): string | 'me' | undefined => {
    if (!v) return undefined;
    if (v === 'me') return 'me';
    const parsed = z.string().uuid().safeParse(v);
    return parsed.success ? parsed.data : undefined;
  });
