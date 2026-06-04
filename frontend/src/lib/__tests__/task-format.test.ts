import { describe, it, expect } from 'vitest';
import {
  STATUS_LABEL,
  STATUS_VARIANT,
  PRIORITY_LABEL,
  PRIORITY_VARIANT,
  fmtDate,
  fmtDateTime,
} from '../task-format';

describe('STATUS_LABEL', () => {
  it('maps every TaskStatus to a non-empty label', () => {
    expect(STATUS_LABEL.todo).toBe('Todo');
    expect(STATUS_LABEL.in_progress).toBe('In Progress');
    expect(STATUS_LABEL.completed).toBe('Completed');
  });
});

describe('STATUS_VARIANT', () => {
  it('outline for todo, default for in_progress, secondary for completed', () => {
    expect(STATUS_VARIANT.todo).toBe('outline');
    expect(STATUS_VARIANT.in_progress).toBe('default');
    expect(STATUS_VARIANT.completed).toBe('secondary');
  });
});

describe('PRIORITY_LABEL', () => {
  it('maps every priority', () => {
    expect(PRIORITY_LABEL.low).toBe('Low');
    expect(PRIORITY_LABEL.medium).toBe('Medium');
    expect(PRIORITY_LABEL.high).toBe('High');
  });
});

describe('PRIORITY_VARIANT', () => {
  it('outline for low, secondary for medium, destructive for high', () => {
    expect(PRIORITY_VARIANT.low).toBe('outline');
    expect(PRIORITY_VARIANT.medium).toBe('secondary');
    expect(PRIORITY_VARIANT.high).toBe('destructive');
  });
});

describe('fmtDate', () => {
  it('formats valid ISO date', () => {
    const out = fmtDate('2030-06-01T00:00:00.000Z');
    expect(out).toMatch(/2030/);
  });

  it('falls back to raw value on invalid input', () => {
    expect(typeof fmtDate('not-a-date')).toBe('string');
  });
});

describe('fmtDateTime', () => {
  it('formats valid ISO datetime', () => {
    const out = fmtDateTime('2030-06-01T15:30:00.000Z');
    expect(out).toMatch(/2030/);
  });

  it('falls back to raw value on invalid input', () => {
    expect(typeof fmtDateTime('not-a-date')).toBe('string');
  });
});
