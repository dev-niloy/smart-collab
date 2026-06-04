import { describe, it, expect } from 'vitest';
import {
  PROJECT_ROLE_LABEL,
  PROJECT_ROLE_VARIANT,
  workloadTone,
  activeWorkloadCount,
} from '../project-member-format';

describe('PROJECT_ROLE_LABEL', () => {
  it('maps pm and member', () => {
    expect(PROJECT_ROLE_LABEL.pm).toBe('Project Manager');
    expect(PROJECT_ROLE_LABEL.member).toBe('Member');
  });
});

describe('PROJECT_ROLE_VARIANT', () => {
  it('pm -> default, member -> outline', () => {
    expect(PROJECT_ROLE_VARIANT.pm).toBe('default');
    expect(PROJECT_ROLE_VARIANT.member).toBe('outline');
  });
});

describe('workloadTone', () => {
  const w = (todo: number, in_progress: number) => ({
    todo,
    in_progress,
    completed: 0,
    due_soon: 0,
  });

  it('returns outline below 5 active', () => {
    expect(workloadTone(w(2, 2))).toBe('outline');
  });

  it('returns secondary at 5-9 active', () => {
    expect(workloadTone(w(3, 2))).toBe('secondary');
    expect(workloadTone(w(5, 4))).toBe('secondary');
  });

  it('returns destructive at 10+ active', () => {
    expect(workloadTone(w(7, 3))).toBe('destructive');
  });
});

describe('activeWorkloadCount', () => {
  it('sums todo + in_progress', () => {
    expect(activeWorkloadCount({ todo: 3, in_progress: 2, completed: 99, due_soon: 7 })).toBe(5);
  });
});
