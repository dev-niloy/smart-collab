import { describe, it, expect } from 'vitest';
import { addMemberSchema, updateMemberRoleSchema, PROJECT_ROLES } from '../project-member';

describe('addMemberSchema', () => {
  it('accepts valid email + role', () => {
    const out = addMemberSchema.parse({ email: 'a@b.co', role: 'pm' });
    expect(out).toEqual({ email: 'a@b.co', role: 'pm' });
  });

  it('lowercases + trims email', () => {
    const out = addMemberSchema.parse({ email: '  A@B.CO  ', role: 'member' });
    expect(out.email).toBe('a@b.co');
  });

  it('defaults role to member when omitted', () => {
    const out = addMemberSchema.parse({ email: 'a@b.co' });
    expect(out.role).toBe('member');
  });

  it('rejects invalid email', () => {
    expect(() => addMemberSchema.parse({ email: 'nope', role: 'pm' })).toThrow();
  });

  it('rejects unknown role', () => {
    expect(() => addMemberSchema.parse({ email: 'a@b.co', role: 'admin' })).toThrow();
  });
});

describe('updateMemberRoleSchema', () => {
  it('accepts pm', () => {
    expect(updateMemberRoleSchema.parse({ role: 'pm' }).role).toBe('pm');
  });

  it('accepts member', () => {
    expect(updateMemberRoleSchema.parse({ role: 'member' }).role).toBe('member');
  });

  it('rejects missing role', () => {
    expect(() => updateMemberRoleSchema.parse({})).toThrow();
  });
});

describe('PROJECT_ROLES', () => {
  it('contains pm and member', () => {
    expect(PROJECT_ROLES).toEqual(['pm', 'member']);
  });
});
