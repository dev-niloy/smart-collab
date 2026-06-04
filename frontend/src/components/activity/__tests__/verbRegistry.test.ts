import { describe, it, expect } from 'vitest';
import { renderVerb, relTime, entityLink } from '../verbRegistry';
import type { ActivityDTO } from '@/lib/schemas/activity';

const base: ActivityDTO = {
  id: 'a-1',
  action: 'task.created',
  actorId: 'u-1',
  actorName: 'Alice',
  entityType: 'task',
  entityId: 't-1',
  projectId: 'p-1',
  meta: { title: 'X' },
  createdAt: '2026-06-04T10:00:00.000Z',
};

describe('verbRegistry.renderVerb', () => {
  it('covers all 10 known actions with sensible text', () => {
    const cases: Array<[string, string | RegExp, Record<string, unknown>?]> = [
      ['task.created', /created task/],
      ['task.updated', /updated task/],
      ['task.deleted', /deleted task/],
      ['task.status_changed', /moved task to/, { to: 'done' }],
      ['task.assigned', /reassigned task/, { to: 'u-2' }],
      ['task.assigned', /unassigned task/, {}],
      ['project.created', /created project/, { name: 'P' }],
      ['project.updated', /updated project/, { name: 'P' }],
      ['project.deleted', /deleted project/, { name: 'P' }],
      ['member.added', /added .* to the project/, { name: 'Bob' }],
      ['member.removed', /removed a member/],
    ];
    for (const [action, m, meta] of cases) {
      const verb = renderVerb({ ...base, action, meta: meta ?? base.meta });
      expect(verb).toMatch(m);
    }
  });

  it('falls back to raw action when unknown', () => {
    expect(renderVerb({ ...base, action: 'mystery.thing' })).toBe('mystery.thing');
  });
});

describe('verbRegistry.relTime', () => {
  const NOW = new Date('2026-06-04T12:00:00.000Z');
  it('returns "just now" under a minute', () => {
    expect(relTime('2026-06-04T11:59:30.000Z', NOW)).toBe('just now');
  });
  it('renders minute / hour / day / month / year buckets', () => {
    expect(relTime('2026-06-04T11:50:00.000Z', NOW)).toBe('10m ago');
    expect(relTime('2026-06-04T08:00:00.000Z', NOW)).toBe('4h ago');
    expect(relTime('2026-06-01T12:00:00.000Z', NOW)).toBe('3d ago');
    expect(relTime('2026-04-01T12:00:00.000Z', NOW)).toBe('2mo ago');
    expect(relTime('2024-06-04T12:00:00.000Z', NOW)).toBe('2y ago');
  });
});

describe('verbRegistry.entityLink', () => {
  it('links to /projects/:id for project entity', () => {
    expect(entityLink({ ...base, entityType: 'project', entityId: 'p-9' })).toBe('/projects/p-9');
  });
  it('links to /projects/:projectId/tasks for task entity', () => {
    expect(entityLink({ ...base, entityType: 'task', projectId: 'p-1' })).toBe('/projects/p-1/tasks');
  });
  it('returns null for task with no projectId', () => {
    expect(entityLink({ ...base, entityType: 'task', projectId: null })).toBeNull();
  });
  it('returns null for unknown entity types', () => {
    expect(entityLink({ ...base, entityType: 'mystery' })).toBeNull();
  });
});
