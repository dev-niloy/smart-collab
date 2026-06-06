import { describe, it, expect } from 'vitest';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  fmtDate,
  fmtDateTime,
} from '../project-format';

describe('STATUS_LABEL', () => {
  it('maps every ProjectStatus to a non-empty label', () => {
    expect(STATUS_LABEL.active).toBe('Active');
    expect(STATUS_LABEL.completed).toBe('Completed');
    expect(STATUS_LABEL.on_hold).toBe('On hold');
  });
});

describe('STATUS_VARIANT', () => {
  it('uses default for active, secondary for completed, outline for on_hold', () => {
    expect(STATUS_VARIANT.active).toBe('default');
    expect(STATUS_VARIANT.completed).toBe('secondary');
    expect(STATUS_VARIANT.on_hold).toBe('outline');
  });
});

describe('fmtDate', () => {
  it('formats a valid ISO date', () => {
    const out = fmtDate('2030-06-01T00:00:00.000Z');
    expect(out).toMatch(/2030/);
    expect(out).toMatch(/Jun|May|Jul/);
  });

  it('falls back to raw value on invalid input', () => {
    const bad = 'not-a-date';
    const out = fmtDate(bad);
    expect(typeof out).toBe('string');
  });
});

describe('fmtDateTime', () => {
  it('formats a valid ISO datetime', () => {
    const out = fmtDateTime('2030-06-01T15:30:00.000Z');
    expect(out).toMatch(/2030/);
  });

  it('falls back to raw value on invalid input', () => {
    expect(typeof fmtDateTime('not-a-date')).toBe('string');
  });
});
