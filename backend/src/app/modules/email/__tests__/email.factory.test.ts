import {
  createEmailProvider,
  EmailConfigError,
  resetEmailProviderCache,
  getEmailProvider,
} from '../email.factory';
import {
  ResendEmailProvider,
  SmtpEmailProvider,
  StubEmailProvider,
} from '../email.provider';

describe('email factory', () => {
  afterEach(() => {
    resetEmailProviderCache();
  });

  it('defaults to stub when EMAIL_PROVIDER is unset', () => {
    const p = createEmailProvider({});
    expect(p).toBeInstanceOf(StubEmailProvider);
    expect(p.name).toBe('stub');
  });

  it('returns stub when EMAIL_PROVIDER is empty string', () => {
    const p = createEmailProvider({ EMAIL_PROVIDER: '' });
    expect(p).toBeInstanceOf(StubEmailProvider);
  });

  it('returns stub when EMAIL_PROVIDER=stub', () => {
    const p = createEmailProvider({ EMAIL_PROVIDER: 'stub' });
    expect(p).toBeInstanceOf(StubEmailProvider);
  });

  it('is case-insensitive on EMAIL_PROVIDER', () => {
    const p = createEmailProvider({ EMAIL_PROVIDER: 'STUB' });
    expect(p).toBeInstanceOf(StubEmailProvider);
  });

  it('returns Resend provider when EMAIL_PROVIDER=resend + creds set', () => {
    const p = createEmailProvider({
      EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_test_xxx',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(p).toBeInstanceOf(ResendEmailProvider);
    expect(p.name).toBe('resend');
  });

  it('throws EmailConfigError when EMAIL_PROVIDER=resend but RESEND_API_KEY missing', () => {
    expect(() =>
      createEmailProvider({ EMAIL_PROVIDER: 'resend', EMAIL_FROM: 'a@b.c' }),
    ).toThrow(EmailConfigError);
  });

  it('throws EmailConfigError when EMAIL_PROVIDER=resend but EMAIL_FROM missing', () => {
    expect(() =>
      createEmailProvider({ EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_x' }),
    ).toThrow(EmailConfigError);
  });

  it('returns SMTP provider when EMAIL_PROVIDER=smtp + creds set', () => {
    const p = createEmailProvider({
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      EMAIL_FROM: 'noreply@example.com',
    });
    expect(p).toBeInstanceOf(SmtpEmailProvider);
    expect(p.name).toBe('smtp');
  });

  it('throws on SMTP missing host', () => {
    expect(() =>
      createEmailProvider({
        EMAIL_PROVIDER: 'smtp',
        SMTP_PORT: '587',
        EMAIL_FROM: 'a@b.c',
      }),
    ).toThrow(EmailConfigError);
  });

  it('throws on invalid SMTP port', () => {
    expect(() =>
      createEmailProvider({
        EMAIL_PROVIDER: 'smtp',
        SMTP_HOST: 'h',
        SMTP_PORT: 'not-a-number',
        EMAIL_FROM: 'a@b.c',
      }),
    ).toThrow(EmailConfigError);
  });

  it('throws on unknown provider', () => {
    expect(() =>
      createEmailProvider({ EMAIL_PROVIDER: 'mandrill' }),
    ).toThrow(EmailConfigError);
  });

  it('getEmailProvider caches across calls', () => {
    const a = getEmailProvider();
    const b = getEmailProvider();
    expect(a).toBe(b);
  });

  it('resetEmailProviderCache forces a fresh instance', () => {
    const a = getEmailProvider();
    resetEmailProviderCache();
    const b = getEmailProvider();
    expect(a).not.toBe(b);
  });

  describe('stub send behavior', () => {
    it('records sent messages and returns ok', async () => {
      const p = new StubEmailProvider();
      const res = await p.send({ to: 'x@y.z', subject: 's', text: 't' });
      expect(res.ok).toBe(true);
      expect(res.provider).toBe('stub');
      expect(p.sent).toHaveLength(1);
      expect(p.sent[0].to).toBe('x@y.z');
    });

    it('reset() clears the buffer', async () => {
      const p = new StubEmailProvider();
      await p.send({ to: 'a@b.c', subject: 's', text: 't' });
      p.reset();
      expect(p.sent).toHaveLength(0);
    });
  });
});
