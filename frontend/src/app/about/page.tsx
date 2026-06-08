import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata = {
  title: 'About — Smart Collab',
  description: 'Why we built Smart Collab and what we believe about team software.',
};

const VALUES = [
  {
    title: 'Opinionated, not loud',
    body: 'Strong defaults beat infinite configuration. Pick the right thing for the team, ship it well.',
  },
  {
    title: 'Respect attention',
    body: 'Notifications are precious. Every ping costs focus. We design for the inbox, not for engagement.',
  },
  {
    title: 'Boring infrastructure',
    body: 'Postgres, signed sessions, predictable HTTP. We pick technology the next maintainer will thank us for.',
  },
  {
    title: 'Honest scope',
    body: 'No feature creep, no half-finished surfaces. If we ship it, it works end-to-end.',
  },
];

const STATS = [
  { n: '<200ms', l: 'p95 server response' },
  { n: '99.95%', l: 'uptime trailing 90d' },
  { n: '0', l: 'dark patterns' },
];

const TEAM = [
  {
    name: 'Niloy Roy',
    role: 'Founding engineer',
    initials: 'NR',
    bio: 'Full-stack engineer. Cares about the boring craft of shipping software users actually use.',
  },
  {
    name: 'You',
    role: 'Future teammate',
    initials: '+',
    bio: 'We stay small on purpose. If this product is what you wish existed, talk to us.',
    cta: true,
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section>
        <div className="mx-auto max-w-[1080px] px-6 pt-20 pb-16 md:pt-28 md:pb-20">
          <div className="max-w-3xl">
            <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.04em] md:text-[64px]">
              We build software
              <br />
              <span className="text-muted-foreground">for teams that ship.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">
              Most project tools are built to be sold. Smart Collab is built to be used. A focused,
              fast, real-time collaboration system for teams that argue about shipping speed
              instead of process.
            </p>
            <div className="mt-9 flex items-center gap-5">
              <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
                Get started
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"
              >
                <span className="size-1.5 rounded-full bg-primary" />
                Want to talk?
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-[1080px] px-6 py-24">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.2fr] md:items-start">
            <h2 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] md:text-[32px]">
              Built by a team that lived the problem.
            </h2>
            <div className="flex flex-col gap-5 text-[15px] leading-relaxed text-muted-foreground md:pt-2">
              <p>
                We used every project tool on the market. Each drifted into the same trap: more
                dashboards, more configuration, more notifications, less actual work. Teams spent
                more time maintaining their tracker than tracking the work.
              </p>
              <p>
                Smart Collab started as an internal tool — a small, fast tracker built for a team
                of five. Real-time invalidation. A single inbox. Projects that mean something.
                Once it stopped getting in our way, we couldn’t go back.
              </p>
              <p>
                Today it’s a product. The bet is simple: a tool that respects the work will win
                the teams that respect the work.
              </p>
            </div>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 text-[13px] md:grid-cols-2 md:gap-12">
            <div className="flex items-baseline gap-3">
              <span className="text-muted-foreground">01</span>
              <span className="text-foreground">Founded 2025</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-muted-foreground">02</span>
              <span className="text-foreground">Remote-first</span>
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-[1080px] px-6 py-24">
          <div className="max-w-2xl">
            <h2 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] md:text-[36px]">
              Principles, not policies.
              <span className="text-muted-foreground">
                {' '}
                We don’t have a fifty-page handbook. We have four things we never compromise on.
              </span>
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
            {VALUES.map((v, i) => (
              <div
                key={v.title}
                className="surface-edge-highlight rounded-xl border border-border/60 bg-card p-7"
              >
                <div className="text-eyebrow mb-3 text-[10.5px]">
                  0{i + 1}
                </div>
                <div className="text-[15px] font-medium tracking-tight">{v.title}</div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                  {v.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-[1080px] px-6 py-20">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.l} className="bg-card p-10 text-center">
                <div className="text-[40px] font-semibold tracking-[-0.035em] leading-none text-foreground md:text-[52px]">
                  {s.n}
                </div>
                <div className="mt-3 text-[12.5px] text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-[1080px] px-6 py-24">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.2fr] md:items-start">
            <h2 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] md:text-[32px]">
              Small team. Big standards.
            </h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground md:pt-2">
              We stay small on purpose. Every person on the team ships product. No layers of
              translation between the people building and the people deciding.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
            {TEAM.map((m) => (
              <div
                key={m.name}
                className="surface-edge-highlight rounded-xl border border-border/60 bg-card p-7"
              >
                <div className="flex items-center gap-4">
                  <div className="grid size-11 place-items-center rounded-full bg-primary/15 text-[14px] font-medium text-primary">
                    {m.initials}
                  </div>
                  <div>
                    <div className="text-[15px] font-medium tracking-tight">{m.name}</div>
                    <div className="text-[12.5px] text-muted-foreground">{m.role}</div>
                  </div>
                </div>
                <p className="mt-5 text-[13.5px] leading-relaxed text-muted-foreground">{m.bio}</p>
                {m.cta && (
                  <div className="mt-5">
                    <Link
                      href="/contact"
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      Say hello
                      <ArrowRight className="ml-1 size-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-[1080px] px-6 py-32">
          <div className="text-center">
            <h2 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.04em] md:text-[64px]">
              Built for the future.
              <br />
              Available today.
            </h2>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
                Get started
              </Link>
              <Link
                href="/contact"
                className={buttonVariants({ variant: 'secondary', size: 'lg' })}
              >
                Contact sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
