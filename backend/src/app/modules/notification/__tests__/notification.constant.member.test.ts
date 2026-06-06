import {
  isKnownNotificationType,
  sanitizeNotificationPayload,
  NOTIFICATION_TYPES,
  PAYLOAD_WHITELIST,
} from '../notification.constant';

describe('notification.constant — project member events', () => {
  it('registers project.member_added + project.member_role_changed as known types', () => {
    expect(isKnownNotificationType('project.member_added')).toBe(true);
    expect(isKnownNotificationType('project.member_role_changed')).toBe(true);
  });

  it('NOTIFICATION_TYPES contains the new types alongside existing ones', () => {
    const t = NOTIFICATION_TYPES as readonly string[];
    expect(t).toContain('project.member_added');
    expect(t).toContain('project.member_role_changed');
    // Sanity: existing types still present.
    expect(t).toContain('task.assigned');
    expect(t).toContain('comment.mention');
  });

  it('does not regress unknown-type detection', () => {
    expect(isKnownNotificationType('project.member_invited')).toBe(false);
    expect(isKnownNotificationType('garbage')).toBe(false);
  });

  it('whitelists project.member payload keys for sanitization', () => {
    const keys = PAYLOAD_WHITELIST as readonly string[];
    expect(keys).toContain('projectName');
    expect(keys).toContain('projectDescription');
    expect(keys).toContain('projectDeadline');
    expect(keys).toContain('memberId');
    expect(keys).toContain('newRole');
    expect(keys).toContain('previousRole');
  });

  it('sanitizeNotificationPayload preserves the new fields', () => {
    const input = {
      projectName: 'Demo Web',
      projectDescription: 'A demo project',
      projectDeadline: '2026-07-01T00:00:00.000Z',
      memberId: 'm-1',
      newRole: 'pm',
      previousRole: 'member',
      projectId: 'p-1',
      // unrelated junk should be stripped
      secret: 'should-not-survive',
    };
    const out = sanitizeNotificationPayload(input);
    expect(out).toEqual({
      projectName: 'Demo Web',
      projectDescription: 'A demo project',
      projectDeadline: '2026-07-01T00:00:00.000Z',
      memberId: 'm-1',
      newRole: 'pm',
      previousRole: 'member',
      projectId: 'p-1',
    });
    expect(out).not.toHaveProperty('secret');
  });

  it('caps long strings (PAYLOAD_STRING_CAP) on the new fields too', () => {
    const long = 'x'.repeat(500);
    const out = sanitizeNotificationPayload({ projectDescription: long });
    expect(out).not.toBeNull();
    expect((out as Record<string, string>).projectDescription.length).toBeLessThan(500);
  });
});
