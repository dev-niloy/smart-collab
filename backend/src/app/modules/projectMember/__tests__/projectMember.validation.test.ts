import {
  addMemberSchema,
  updateMemberRoleSchema,
  memberIdParamSchema,
} from '../projectMember.validation';

describe('addMemberSchema', () => {
  it('accepts valid email + role', () => {
    const out = addMemberSchema.parse({ email: 'a@b.co', role: 'pm' });
    expect(out).toEqual({ email: 'a@b.co', role: 'pm' });
  });

  it('lowercases + trims email', () => {
    const out = addMemberSchema.parse({ email: '  A@B.CO ', role: 'member' });
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
    expect(() =>
      addMemberSchema.parse({ email: 'a@b.co', role: 'admin' }),
    ).toThrow();
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

describe('memberIdParamSchema', () => {
  it('accepts two uuids', () => {
    const out = memberIdParamSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      memberId: '22222222-2222-4222-8222-222222222222',
    });
    expect(out.id).toMatch(/-/);
  });

  it('rejects non-uuid id', () => {
    expect(() =>
      memberIdParamSchema.parse({ id: 'x', memberId: '22222222-2222-4222-8222-222222222222' }),
    ).toThrow();
  });
});
