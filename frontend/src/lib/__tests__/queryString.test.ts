import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv, parseDateParam } from '../queryString';

describe('queryString helpers', () => {
  it('parseCsv splits + trims + dedupes', () => {
    expect(parseCsv('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseCsv(' a , b ')).toEqual(['a', 'b']);
    expect(parseCsv('a,a,b,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('parseCsv empty/nullish → []', () => {
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv(null)).toEqual([]);
    expect(parseCsv(undefined)).toEqual([]);
  });

  it('toCsv joins with commas + dedupes', () => {
    expect(toCsv(['a', 'b', 'c'])).toBe('a,b,c');
    expect(toCsv(['a', 'a', 'b'])).toBe('a,b');
    expect(toCsv([])).toBe('');
  });

  it('toCsv trims empty/whitespace tokens', () => {
    expect(toCsv(['a', '', '   ', 'b'])).toBe('a,b');
  });

  it('parseDateParam accepts valid ISO date', () => {
    expect(parseDateParam('2026-06-04')).toBe('2026-06-04');
    expect(parseDateParam('2026-06-04T10:00:00.000Z')).toBe('2026-06-04T10:00:00.000Z');
  });

  it('parseDateParam returns undefined for invalid', () => {
    expect(parseDateParam('not-a-date')).toBeUndefined();
    expect(parseDateParam(null)).toBeUndefined();
    expect(parseDateParam(undefined)).toBeUndefined();
  });
});
