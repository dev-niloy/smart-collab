import { describe, it, expect } from 'vitest';
import { getPanelKey, pickPanel } from '../routeToPanel';

describe('routeToPanel', () => {
  it('returns null for null or unknown pathnames', () => {
    expect(getPanelKey(null)).toBeNull();
    expect(getPanelKey('/login')).toBeNull();
    expect(getPanelKey('/signup')).toBeNull();
    expect(getPanelKey('/')).toBeNull();
  });

  it('matches /dashboard root', () => {
    expect(getPanelKey('/dashboard')).toBe('dashboard');
  });

  it('matches /projects root and nested routes (prefix-match)', () => {
    expect(getPanelKey('/projects')).toBe('projects');
    expect(getPanelKey('/projects/abc-123')).toBe('projects');
    expect(getPanelKey('/projects/abc-123/tasks/def-456')).toBe('projects');
    expect(getPanelKey('/projects/abc-123/tasks/def-456/edit')).toBe('projects');
  });

  it('matches /inbox', () => {
    expect(getPanelKey('/inbox')).toBe('inbox');
    expect(getPanelKey('/inbox/details')).toBe('inbox');
  });

  it('pickPanel returns the matching ReactNode by route', () => {
    const panels = {
      dashboard: 'DASH',
      projects: 'PROJ',
      inbox: 'INB',
    } as const;

    expect(pickPanel('/dashboard', panels)).toBe('DASH');
    expect(pickPanel('/projects/123', panels)).toBe('PROJ');
    expect(pickPanel('/inbox', panels)).toBe('INB');
    expect(pickPanel('/login', panels)).toBeNull();
    expect(pickPanel('/projects', { dashboard: 'DASH' })).toBeNull();
  });
});
