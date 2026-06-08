'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Mail, MapPin, MessageCircle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MarketingShell } from '@/components/marketing/MarketingShell';

const SUPPORT_EMAIL = 'solvemeet@gmail.com';

const REASONS = [
  { value: 'sales', label: 'Talk to sales' },
  { value: 'support', label: 'Product support' },
  { value: 'partnership', label: 'Partnerships' },
  { value: 'other', label: 'Something else' },
];

const CHANNELS = [
  {
    icon: Mail,
    title: 'Email us',
    body: SUPPORT_EMAIL,
    href: `mailto:${SUPPORT_EMAIL}`,
    cta: 'Send email',
  },
  {
    icon: MessageCircle,
    title: 'Live chat',
    body: 'Available Mon–Fri, 9am–6pm UTC.',
    href: `mailto:${SUPPORT_EMAIL}?subject=Live%20chat%20request`,
    cta: 'Start a chat',
  },
  {
    icon: MapPin,
    title: 'Where we are',
    body: 'Remote-first team. Hubs in Dhaka & SF.',
    href: '/about',
    cta: 'Meet the team',
  },
];

export function ContactPageClient() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const reason = String(data.get('reason') ?? 'other');
    const company = String(data.get('company') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    const subject = `[Smart Collab] ${REASONS.find((r) => r.value === reason)?.label ?? 'Contact'} — ${name || 'New inquiry'}`;
    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Company: ${company || '—'}`,
      `Reason: ${reason}`,
      '',
      message,
    ].join('\n');

    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Open user's mail client. Fallback shows confirmation either way.
    try {
      window.location.href = href;
    } catch {
      /* noop */
    }

    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      form.reset();
    }, 400);
  };

  return (
    <MarketingShell>
      {/* Hero */}
      <section>
        <div className="mx-auto max-w-[1280px] px-6 pt-24 pb-12 md:pt-32 md:pb-16">
          <div className="max-w-3xl">
            <div className="text-eyebrow mb-4">Contact</div>
            <h1 className="text-display-xl">
              We read every message.{' '}
              <span className="text-muted-foreground">Send one.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Questions about pricing, an enterprise deal, a bug you found, or just want to say
              hi — the form below lands directly in our inbox.
            </p>
          </div>
        </div>
      </section>

      {/* Form + channels */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.4fr_1fr]">
            {/* Form */}
            <div className="surface-edge-highlight rounded-2xl border border-border/70 bg-card p-7 md:p-10">
              {submitted ? (
                <SuccessState onReset={() => setSubmitted(false)} />
              ) : (
                <form className="flex flex-col gap-5" onSubmit={onSubmit}>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field label="Name" htmlFor="name">
                      <Input id="name" name="name" required placeholder="Your full name" />
                    </Field>
                    <Field label="Work email" htmlFor="email">
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        required
                        placeholder="you@company.com"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field label="Company" htmlFor="company" optional>
                      <Input id="company" name="company" placeholder="Where you work" />
                    </Field>
                    <Field label="Reason" htmlFor="reason">
                      <select
                        id="reason"
                        name="reason"
                        defaultValue="sales"
                        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
                      >
                        {REASONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Message" htmlFor="message">
                    <Textarea
                      id="message"
                      name="message"
                      required
                      placeholder="Tell us what you’re working on, what’s in the way, or what you want to know."
                      rows={6}
                    />
                  </Field>

                  <div className="mt-2 flex items-center justify-between gap-4">
                    <p className="text-[12px] text-muted-foreground">
                      We typically reply within one business day.
                    </p>
                    <Button type="submit" disabled={submitting} size="lg">
                      {submitting ? 'Sending…' : 'Send message'}
                      <ArrowRight className="ml-1 size-4" />
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Channels */}
            <div className="flex flex-col gap-4">
              {CHANNELS.map(({ icon: Icon, title, body, href, cta }) => (
                <a
                  key={title}
                  href={href}
                  className="surface-edge-highlight group flex items-start gap-4 rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-border"
                >
                  <div className="grid size-10 place-items-center rounded-md border border-border/70 bg-background text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium tracking-tight">{title}</div>
                    <div className="mt-1 truncate text-[13px] text-muted-foreground">{body}</div>
                    <div className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-primary">
                      {cta}
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </a>
              ))}

              <div className="rounded-xl border border-dashed border-border/60 bg-background p-6">
                <div className="text-eyebrow mb-2">Enterprise</div>
                <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                  For SSO, custom contracts, or procurement questions, mention “enterprise” in the
                  form and we’ll route it to the right person.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-20">
          <div className="surface-edge-highlight rounded-2xl border border-border/70 bg-card p-10 md:p-14">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h2 className="text-display-md">Don’t need to talk? Just try it.</h2>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                  The fastest answer to most questions is to spin up an account. Free, no card.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <Link href="/signup" className={buttonVariants({ size: 'lg' })}>Get started free
                    <ArrowRight className="ml-1 size-4" /></Link>
                <Link href="/about" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>About us</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-[13px]">
        {label}
        {optional && <span className="ml-1 text-muted-foreground">(optional)</span>}
      </Label>
      {children}
    </div>
  );
}

function SuccessState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-5 py-6">
      <div className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
        <Check className="size-6" />
      </div>
      <div>
        <h2 className="text-display-md">Message ready to send.</h2>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          Your mail client should have opened with the message drafted. If it didn’t, write to{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{' '}
          directly — we’ll get back within one business day.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={onReset} variant="secondary">
          Send another
        </Button>
        <Link href="/" className={buttonVariants({  })}>Back to home</Link>
      </div>
    </div>
  );
}
