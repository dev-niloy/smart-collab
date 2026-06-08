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
  },
  {
    icon: MessageCircle,
    title: 'Live chat',
    body: 'Mon–Fri, 9am–6pm UTC.',
    href: `mailto:${SUPPORT_EMAIL}?subject=Live%20chat%20request`,
  },
  {
    icon: MapPin,
    title: 'Where we are',
    body: 'Remote-first. Hubs in Dhaka & SF.',
    href: '/about',
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
        <div className="mx-auto max-w-[1080px] px-6 pt-20 pb-12 md:pt-28 md:pb-16">
          <div className="max-w-3xl">
            <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.04em] md:text-[64px]">
              We read every message.
              <br />
              <span className="text-muted-foreground">Send one.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">
              Questions on pricing, an enterprise deal, a bug, or just want to say hi — drop us a
              line. Typical response within one business day.
            </p>
          </div>
        </div>
      </section>

      {/* Channels strip */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-[1080px] px-6 py-10">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-3">
            {CHANNELS.map(({ icon: Icon, title, body, href }) => (
              <a
                key={title}
                href={href}
                className="group flex items-start gap-4 bg-card p-7 transition-colors hover:bg-[#141516]"
              >
                <div className="grid size-9 place-items-center rounded-md border border-border/70 bg-background text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-medium tracking-tight">{title}</div>
                  <div className="mt-1 truncate text-[12.5px] text-muted-foreground">{body}</div>
                  <div className="mt-3 inline-flex items-center gap-1 text-[12px] text-primary">
                    Open
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-[1080px] px-6 py-24">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.2fr] md:items-start">
            <h2 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] md:text-[32px]">
              Drop us a line.
            </h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground md:pt-2">
              The form below opens your mail client pre-filled with the right subject and a clean
              summary. If your client doesn’t open, write to{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-foreground underline-offset-4 hover:underline"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </div>

          <div className="surface-edge-highlight mt-12 overflow-hidden rounded-2xl border border-border/60 bg-card p-7 md:p-10">
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
                    rows={6}
                    placeholder="Tell us what you’re working on, what’s in the way, or what you want to know."
                  />
                </Field>
                <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-[12px] text-muted-foreground">
                    We reply within one business day.
                  </p>
                  <Button type="submit" disabled={submitting} size="lg">
                    {submitting ? 'Sending…' : 'Send message'}
                    <ArrowRight className="ml-1 size-4" />
                  </Button>
                </div>
              </form>
            )}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 text-[13px] md:grid-cols-2 md:gap-12">
            <div className="flex items-baseline gap-3">
              <span className="text-muted-foreground">01</span>
              <span className="text-foreground">Sales & enterprise</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-muted-foreground">02</span>
              <span className="text-foreground">Product support</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-[1080px] px-6 py-32">
          <div className="text-center">
            <h2 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.04em] md:text-[64px]">
              Don’t need to talk?
              <br />
              Just try it.
            </h2>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
                Get started
              </Link>
              <Link href="/about" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                About us
              </Link>
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
      <Label htmlFor={htmlFor} className="text-[12.5px]">
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
        <h3 className="text-[26px] font-semibold tracking-[-0.025em]">Message ready to send.</h3>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-muted-foreground">
          Your mail client should have opened with the message drafted. If it didn’t, write to{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{' '}
          directly.
        </p>
      </div>
      <div className="flex gap-3">
        <Button onClick={onReset} variant="secondary">
          Send another
        </Button>
        <Link href="/" className={buttonVariants({})}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
