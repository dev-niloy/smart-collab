import Link from 'next/link';
import { ArrowRight, Compass, Heart, Lightbulb, ShieldCheck, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export const metadata = {
  title: 'About — Smart Collab',
  description: 'Why we built Smart Collab and what we believe about team software.',
};

const VALUES = [
  {
    icon: Compass,
    title: 'Opinionated, not loud',
    body: 'Strong defaults beat infinite configuration. Pick the right thing for the team, ship it well.',
  },
  {
    icon: Heart,
    title: 'Respect attention',
    body: 'Notifications are precious. Every ping costs focus. We design for the inbox, not for engagement.',
  },
  {
    icon: ShieldCheck,
    title: 'Boring infrastructure',
    body: 'Postgres, signed sessions, predictable HTTP. We pick technology that the next maintainer will thank us for.',
  },
  {
    icon: Lightbulb,
    title: 'Honest scope',
    body: 'No feature creep, no half-finished surfaces. If we ship it, it works end-to-end.',
  },
];

const STATS = [
  { n: '< 200ms', l: 'p95 server response' },
  { n: '100%', l: 'open-source frontend' },
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
    bio: 'We’re a small, focused team. If this product is what you wish existed, talk to us.',
    cta: true,
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section>
        <div className="mx-auto max-w-[1280px] px-6 pt-24 pb-16 md:pt-32 md:pb-20">
          <div className="max-w-3xl">
            <div className="text-eyebrow mb-4">About</div>
            <h1 className="text-display-xl">
              We build software for{' '}
              <span className="text-muted-foreground">teams that ship.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Most project tools are built to be sold. Smart Collab is built to be used. We make a
              focused, fast, real-time collaboration system for the kind of teams that argue about
              shipping speed instead of process.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonVariants({ size: 'lg' })}>Try Smart Collab
                  <ArrowRight className="ml-1 size-4" /></Link>
              <Link href="/contact" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>Get in touch</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <div className="text-eyebrow mb-3">Our story</div>
              <h2 className="text-display-md">Built by a team that lived the problem.</h2>
            </div>
            <div className="flex flex-col gap-5 text-[15px] leading-relaxed text-muted-foreground">
              <p>
                We used every project tool on the market. Each one drifted into the same trap:
                more dashboards, more configuration, more notifications, less actual work. Teams
                spent more time maintaining their tracker than tracking the work.
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
        </div>
      </section>

      {/* Values */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="max-w-2xl">
            <div className="text-eyebrow mb-3">What we believe</div>
            <h2 className="text-display-lg">Principles, not policies.</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              We don’t have a fifty-page handbook. We have four things we never compromise on.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="surface-edge-highlight rounded-xl border border-border/60 bg-card p-7"
              >
                <div className="grid size-9 place-items-center rounded-md border border-border/70 bg-background text-primary">
                  <Icon className="size-4" />
                </div>
                <div className="mt-5 text-[17px] font-medium tracking-tight">{title}</div>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-20">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STATS.map((s) => (
              <div
                key={s.l}
                className="surface-edge-highlight rounded-xl border border-border/60 bg-card p-8 text-center"
              >
                <div className="text-[44px] font-semibold tracking-[-0.03em] leading-none text-foreground">
                  {s.n}
                </div>
                <div className="mt-2 text-[13px] text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="max-w-2xl">
            <div className="text-eyebrow mb-3 inline-flex items-center gap-2">
              <Users className="size-3.5 text-primary" />
              Team
            </div>
            <h2 className="text-display-lg">Small team. Big standards.</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              We stay small on purpose. Every person on the team ships product.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
            {TEAM.map((m) => (
              <div
                key={m.name}
                className="surface-edge-highlight rounded-xl border border-border/60 bg-card p-7"
              >
                <div className="flex items-center gap-4">
                  <div className="grid size-12 place-items-center rounded-full bg-primary/15 text-primary text-[15px] font-medium">
                    {m.initials}
                  </div>
                  <div>
                    <div className="text-[16px] font-medium tracking-tight">{m.name}</div>
                    <div className="text-[13px] text-muted-foreground">{m.role}</div>
                  </div>
                </div>
                <p className="mt-5 text-[14px] leading-relaxed text-muted-foreground">{m.bio}</p>
                {m.cta && (
                  <div className="mt-5">
                    <Link href="/contact" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Say hello
                        <ArrowRight className="ml-1 size-3.5" /></Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-20">
          <div className="surface-edge-highlight rounded-2xl border border-border/70 bg-card p-10 md:p-14">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h2 className="text-display-md">Want to see it work?</h2>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                  Sign up free, invite your team, ship something this week.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <Link href="/signup" className={buttonVariants({ size: 'lg' })}>Get started
                    <ArrowRight className="ml-1 size-4" /></Link>
                <Link href="/contact" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>Contact us</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
