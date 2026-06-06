// Provider-agnostic email surface. The notification pipeline (and any other
// future caller) only ever talks to `EmailProvider`; concrete senders
// (Resend / SMTP / stub) live behind the factory.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
};

export type EmailSendResult = {
  ok: boolean;
  id?: string;
  provider: string;
  error?: string;
};

export interface EmailProvider {
  readonly name: 'resend' | 'smtp' | 'stub';
  send(msg: EmailMessage): Promise<EmailSendResult>;
}

// Pure stub used when EMAIL_PROVIDER is unset or === 'stub'. Records sends to
// an in-memory buffer so tests can assert without external network. Production
// code must NEVER configure stub.
export class StubEmailProvider implements EmailProvider {
  readonly name = 'stub' as const;
  readonly sent: EmailMessage[] = [];

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(msg);
    return { ok: true, id: `stub-${this.sent.length}`, provider: 'stub' };
  }

  reset(): void {
    this.sent.length = 0;
  }
}

// Resend (https://resend.com). Lazy-imports the SDK so tests + envs without
// the dep aren't forced to install it.
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend' as const;
  private readonly apiKey: string;
  private readonly defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    try {
      const { Resend } = await import('resend');
      const client = new Resend(this.apiKey);
      const res = await client.emails.send({
        from: msg.from ?? this.defaultFrom,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      });
      if (res.error) {
        return { ok: false, provider: 'resend', error: res.error.message };
      }
      return { ok: true, id: res.data?.id, provider: 'resend' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, provider: 'resend', error: message };
    }
  }
}

// Generic SMTP via nodemailer. Lazy-imports too.
export type SmtpConfig = {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  secure?: boolean;
  defaultFrom: string;
};

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp' as const;
  private readonly cfg: SmtpConfig;

  constructor(cfg: SmtpConfig) {
    this.cfg = cfg;
  }

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: this.cfg.host,
        port: this.cfg.port,
        secure: this.cfg.secure ?? this.cfg.port === 465,
        ...(this.cfg.user && this.cfg.pass
          ? { auth: { user: this.cfg.user, pass: this.cfg.pass } }
          : {}),
      });
      const info = await transporter.sendMail({
        from: msg.from ?? this.cfg.defaultFrom,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        ...(msg.html ? { html: msg.html } : {}),
      });
      return { ok: true, id: info.messageId, provider: 'smtp' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, provider: 'smtp', error: message };
    }
  }
}
