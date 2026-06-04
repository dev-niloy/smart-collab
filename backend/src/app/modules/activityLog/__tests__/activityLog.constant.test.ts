import { ACTIONS, ENTITY_TYPES, sanitizeMeta, isKnownAction } from '../activityLog.constant';

describe('activityLog constants', () => {
  it('ACTIONS includes all task/project/member events', () => {
    const required = [
      'task.created',
      'task.updated',
      'task.deleted',
      'task.status_changed',
      'task.assigned',
      'project.created',
      'project.updated',
      'project.deleted',
      'member.added',
      'member.removed',
    ];
    for (const a of required) {
      expect(ACTIONS).toContain(a);
    }
  });

  it('ENTITY_TYPES includes task/project/member', () => {
    expect(ENTITY_TYPES).toEqual(expect.arrayContaining(['task', 'project', 'member']));
  });

  it('sanitizeMeta strips passwordHash and other disallowed keys', () => {
    const input = {
      title: 'New title',
      passwordHash: 'secret',
      token: 'abc',
      from: 'todo',
      to: 'done',
    };
    const out = sanitizeMeta(input);
    expect(out).toEqual({ title: 'New title', from: 'todo', to: 'done' });
    expect(out).not.toHaveProperty('passwordHash');
    expect(out).not.toHaveProperty('token');
  });

  it('isKnownAction recognises valid actions and rejects unknown', () => {
    expect(isKnownAction('task.created')).toBe(true);
    expect(isKnownAction('does.not.exist')).toBe(false);
  });
});
