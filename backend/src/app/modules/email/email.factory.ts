import {
  type EmailProvider,
  ResendEmailProvider,
  SmtpEmailProvider,
  StubEmailProvider,
} from './email.provider';

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailConfigError';
  }
}

const requireEnv = (env: NodeJS.ProcessEnv, key: string): string => {
  const v = env[key];
  if (!v || !v.trim()) {
    throw new EmailConfigError(`${key} is required when EMAIL_PROVIDER is set to ${env.EMAIL_PROVIDER}`);
  }
  return v;
};

// Build the active provider from environment. Defaults to 'stub' so the app
// boots in dev/test without any email credentials and we never accidentally
// send real mail from a misconfigured environment.
export const createEmailProvider = (
  env: NodeJS.ProcessEnv = process.env,
): EmailProvider => {
  const choice = (env.EMAIL_PROVIDER ?? 'stub').toLowerCase().trim();

  if (choice === 'stub' || choice === '') {
    return new StubEmailProvider();
  }

  if (choice === 'resend') {
    return new ResendEmailProvider(
      requireEnv(env, 'RESEND_API_KEY'),
      requireEnv(env, 'EMAIL_FROM'),
    );
  }

  if (choice === 'smtp') {
    const portRaw = requireEnv(env, 'SMTP_PORT');
    const port = Number(portRaw);
    if (!Number.isFinite(port) || port <= 0) {
      throw new EmailConfigError(`SMTP_PORT must be a positive number, got: ${portRaw}`);
    }
    return new SmtpEmailProvider({
      host: requireEnv(env, 'SMTP_HOST'),
      port,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE.toLowerCase() === 'true' : undefined,
      defaultFrom: requireEnv(env, 'EMAIL_FROM'),
    });
  }

  throw new EmailConfigError(
    `Unknown EMAIL_PROVIDER: ${choice}. Expected one of: stub, resend, smtp.`,
  );
};

let cached: EmailProvider | undefined;

export const getEmailProvider = (): EmailProvider => {
  if (!cached) cached = createEmailProvider();
  return cached;
};

export const resetEmailProviderCache = (): void => {
  cached = undefined;
};
