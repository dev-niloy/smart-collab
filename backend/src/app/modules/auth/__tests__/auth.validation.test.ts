import {
  signupSchema,
  loginSchema,
  demoLoginSchema,
} from '../auth.validation';
import { ACCESS_COOKIE, REFRESH_COOKIE, ROLES, BCRYPT_ROUNDS } from '../auth.constant';

describe('auth.constant', () => {
  it('exposes distinct cookie names', () => {
    expect(ACCESS_COOKIE).toBeTruthy();
    expect(REFRESH_COOKIE).toBeTruthy();
    expect(ACCESS_COOKIE).not.toBe(REFRESH_COOKIE);
  });

  it('ROLES contains the 3 role tokens', () => {
    expect(ROLES).toEqual(expect.arrayContaining(['admin', 'project_manager', 'team_member']));
    expect(ROLES).toHaveLength(3);
  });

  it('bcrypt rounds is safe (>=10)', () => {
    expect(BCRYPT_ROUNDS).toBeGreaterThanOrEqual(10);
  });
});

describe('signupSchema', () => {
  it('accepts a valid signup payload', () => {
    const r = signupSchema.safeParse({
      email: 'alice@example.com',
      password: 'StrongPass123',
      name: 'Alice',
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const r = signupSchema.safeParse({ email: 'not-an-email', password: 'StrongPass123', name: 'A' });
    expect(r.success).toBe(false);
  });

  it('rejects short password (<8)', () => {
    const r = signupSchema.safeParse({ email: 'a@b.com', password: 'short1', name: 'A' });
    expect(r.success).toBe(false);
  });

  it('rejects empty name', () => {
    const r = signupSchema.safeParse({ email: 'a@b.com', password: 'StrongPass123', name: '' });
    expect(r.success).toBe(false);
  });

  it('lowercases email', () => {
    const r = signupSchema.safeParse({ email: 'ALICE@Example.COM', password: 'StrongPass123', name: 'A' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('alice@example.com');
  });
});

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', password: 'whatever1' });
    expect(r.success).toBe(true);
  });

  it('rejects missing password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com' });
    expect(r.success).toBe(false);
  });
});

describe('demoLoginSchema', () => {
  it('accepts each of 3 roles', () => {
    for (const role of ['admin', 'project_manager', 'team_member']) {
      const r = demoLoginSchema.safeParse({ role });
      expect(r.success).toBe(true);
    }
  });

  it('rejects unknown role', () => {
    const r = demoLoginSchema.safeParse({ role: 'superuser' });
    expect(r.success).toBe(false);
  });
});
