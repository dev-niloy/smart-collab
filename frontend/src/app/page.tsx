import Link from 'next/link';
import { ArrowRight, Check, MessageSquare, Sparkles } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { MarketingShell } from '@/components/marketing/MarketingShell';

export default function LandingPage() {
  return (
    <MarketingShell>
      <Hero />
      <LogoStrip />
      <PillarsSection />
      <FeatureSection
        title="Make project operations self-driving."
        body="Turn conversations and stand-up notes into actionable tasks that are routed, labeled, and prioritized for the right teammate."
        links={[
          { n: '01', label: 'Smart Inbox' },
          { n: '02', label: 'Auto-routing' },
        ]}
      >
        <InboxMock />
      </FeatureSection>
      <FeatureSection
        title="Define the product direction."
        body="Plan and navigate from idea to launch. Align your team with project initiatives, strategic roadmaps, and up-to-date PRDs."
        links={[
          { n: '01', label: 'Projects' },
          { n: '02', label: 'Roadmaps' },
        ]}
      >
        <ProjectMock />
      </FeatureSection>
      <FeatureSection
        title="Move work forward across teams."
        body="Hand off cleanly. Assign, comment, attach — work on complex tasks together or delegate entire issues end-to-end."
        links={[
          { n: '01', label: 'Assignments' },
          { n: '02', label: 'Discussions' },
        ]}
      >
        <TaskMock />
      </FeatureSection>
      <FeatureSection
        title="Review work at a glance."
        body="Understand changes with structural diffs for tasks and project deliverables. Review, discuss, and merge — all within Smart Collab."
        links={[
          { n: '01', label: 'Activity log' },
          { n: '02', label: 'Approvals' },
        ]}
      >
        <DiffMock />
      </FeatureSection>
      <FeatureSection
        title="Understand progress at scale."
        body="Take the guesswork out of delivery with project updates, analytics, and dashboards that surface what needs your attention."
        links={[
          { n: '01', label: 'Pulse' },
          { n: '02', label: 'Insights' },
        ]}
      >
        <PulseMock />
      </FeatureSection>
      <Changelog />
      <Testimonials />
      <FinalCta />
    </MarketingShell>
  );
}

/* ------------------------------ sections ------------------------------ */

function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1080px] px-6 pt-20 pb-16 md:pt-28 md:pb-20">
        <div className="max-w-3xl">
          <h1 className="text-[44px] font-semibold leading-[1.05] tracking-[-0.04em] md:text-[64px]">
            The collaboration system
            <br />
            for teams that ship.
          </h1>
          <p className="mt-7 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">
            Purpose-built for modern teams. Smart Collab sets a new standard for planning,
            tracking, and shipping product.
          </p>
          <div className="mt-9 flex items-center gap-5">
            <Link href="/signup" className={buttonVariants({ size: 'lg' })}>
              Get started
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"
            >
              <span className="size-1.5 rounded-full bg-primary" />
              Now tracking is real-time
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="surface-edge-highlight relative mt-16 overflow-hidden rounded-2xl border border-border/70 bg-card p-2 shadow-[0_60px_120px_-40px_rgba(94,106,210,0.35)]">
          <DashboardMock />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-32 mx-auto h-72 max-w-[900px] bg-[radial-gradient(ellipse_at_center,rgba(94,106,210,0.22),transparent_60%)] blur-3xl"
        />
      </div>
    </section>
  );
}

function LogoStrip() {
  const logos = ['Vercel', 'Cursor', 'OSCP', 'OpenAI', 'Coinbase', 'Cash App', 'ScaleAI', 'Ramp'];
  return (
    <section className="border-t border-border/40">
      <div className="mx-auto max-w-[1080px] px-6 py-12">
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-[13px] text-muted-foreground/80">
          {logos.map((l) => (
            <span key={l} className="font-medium tracking-tight">
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PillarsSection() {
  const pillars = [
    {
      title: 'Built for purpose',
      body: 'Smart Collab is shaped by the principles and practices of world-class teams.',
      icon: <CubeIcon />,
    },
    {
      title: 'Real-time by default',
      body: 'Every change syncs across every tab and teammate in milliseconds.',
      icon: <StackIcon />,
    },
    {
      title: 'Designed for speed',
      body: 'Intensely focused on speed, refined craft, and quality at every surface.',
      icon: <BladeIcon />,
    },
  ];
  return (
    <section id="features" className="border-t border-border/40">
      <div className="mx-auto max-w-[1080px] px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.025em] md:text-[36px]">
            A new species of product tool.
            <span className="text-muted-foreground">
              {' '}
              Purpose-built for modern teams with collaboration at its core, Smart Collab sets a
              new standard for planning and building.
            </span>
          </h2>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="surface-edge-highlight rounded-xl border border-border/60 bg-card p-7"
            >
              <div className="h-28 w-full overflow-hidden rounded-lg">{p.icon}</div>
              <div className="mt-6 text-[15px] font-medium tracking-tight">{p.title}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureSection({
  title,
  body,
  links,
  children,
}: {
  title: string;
  body: string;
  links: { n: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/40">
      <div className="mx-auto max-w-[1080px] px-6 py-24">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1fr_1.2fr] md:items-start">
          <h2 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] md:text-[32px]">
            {title}
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground md:pt-2">{body}</p>
        </div>
        <div className="surface-edge-highlight mt-12 overflow-hidden rounded-2xl border border-border/60 bg-card p-2">
          {children}
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 text-[13px] md:grid-cols-2 md:gap-12">
          {links.map((l) => (
            <div key={l.label} className="flex items-baseline gap-3">
              <span className="text-muted-foreground">{l.n}</span>
              <span className="text-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Changelog() {
  const items = [
    {
      title: 'Team documents',
      body: 'Spec, plan, and document together. Use embedded canvases inline with tasks.',
    },
    {
      title: 'Smart Collab SDKs',
      body: 'Build deep automations on top of Smart Collab with our new TypeScript SDK.',
    },
    {
      title: 'Project hub improvements',
      body: 'Filter and pivot on any field across every project in the workspace.',
    },
    {
      title: 'Smart Intelligence',
      body: 'Suggest reviewers, due dates, and follow-ups based on past behaviour.',
    },
  ];
  return (
    <section className="border-t border-border/40">
      <div className="mx-auto max-w-[1080px] px-6 py-24">
        <h2 className="text-[26px] font-semibold tracking-[-0.025em] md:text-[32px]">Changelog</h2>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-4 md:gap-8">
          {items.map((c) => (
            <div key={c.title} className="border-t border-border/60 pt-5">
              <div className="text-[14.5px] font-medium tracking-tight">{c.title}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{c.body}</p>
              <Link
                href="#"
                className="mt-4 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground"
              >
                See all
                <ArrowRight className="size-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="border-t border-border/40">
      <div className="mx-auto max-w-[1080px] px-6 py-20">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Lavender card */}
          <div className="relative overflow-hidden rounded-2xl bg-[#dcdfff] p-10 text-[#0a0a14]">
            <blockquote className="relative z-10 text-[26px] font-semibold leading-[1.2] tracking-[-0.03em] md:text-[30px]">
              “You just have to use it and you will see. You will just feel it.”
            </blockquote>
            <div className="relative z-10 mt-10 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-[#0a0a14] text-[12px] font-medium text-[#f7f8f8]">
                GP
              </div>
              <div>
                <div className="text-[13px] font-medium">Gabriel Perez</div>
                <div className="text-[11.5px] opacity-70">Engineering Lead, Vercel</div>
              </div>
            </div>
            <svg
              aria-hidden
              className="pointer-events-none absolute -right-10 -bottom-10 size-72 opacity-[0.18]"
              viewBox="0 0 100 100"
            >
              <circle cx="50" cy="50" r="48" fill="none" stroke="#0a0a14" strokeWidth="0.6" />
              <circle cx="50" cy="50" r="32" fill="none" stroke="#0a0a14" strokeWidth="0.6" />
              <circle cx="50" cy="50" r="16" fill="none" stroke="#0a0a14" strokeWidth="0.6" />
            </svg>
          </div>

          {/* Lime card */}
          <div className="relative overflow-hidden rounded-2xl bg-[#d2db5e] p-10 text-[#0a0a14]">
            <blockquote className="text-[26px] font-semibold leading-[1.2] tracking-[-0.03em] md:text-[30px]">
              “Our speed is intense and Smart Collab helps us be action-biased.”
            </blockquote>
            <div className="mt-10 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-[#0a0a14] text-[12px] font-medium text-[#f7f8f8]">
                AS
              </div>
              <div>
                <div className="text-[13px] font-medium">Aki Sahara</div>
                <div className="text-[11.5px] opacity-70">Head of Engineering, Ramp</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative">
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
  );
}

/* ------------------------------ icons ------------------------------ */

function CubeIcon() {
  return (
    <div className="grid h-full w-full place-items-center">
      <svg viewBox="0 0 120 120" className="size-24" aria-hidden>
        <g fill="none" stroke="#62666d" strokeWidth="1" strokeLinejoin="round">
          <path d="M60 20 L100 40 L60 60 L20 40 Z" />
          <path d="M20 40 L20 80 L60 100 L60 60 Z" />
          <path d="M100 40 L100 80 L60 100 L60 60 Z" />
        </g>
      </svg>
    </div>
  );
}

function StackIcon() {
  return (
    <div className="grid h-full w-full place-items-center">
      <svg viewBox="0 0 140 120" className="size-28" aria-hidden>
        <g fill="none" stroke="#62666d" strokeWidth="1" strokeLinejoin="round">
          <path d="M40 30 L80 50 L40 70 L0 50 Z" />
          <path d="M0 50 L0 78 L40 98 L40 70 Z" />
          <path d="M80 50 L80 78 L40 98 L40 70 Z" />
          <path d="M90 18 L130 38 L90 58 L50 38 Z" />
        </g>
      </svg>
    </div>
  );
}

function BladeIcon() {
  return (
    <div className="grid h-full w-full place-items-center">
      <svg viewBox="0 0 140 120" className="size-28" aria-hidden>
        <g fill="none" stroke="#62666d" strokeWidth="1" strokeLinejoin="round">
          <path d="M20 90 L120 30 L120 50 L20 110 Z" />
          <path d="M20 90 L20 110 L120 50" />
          <path d="M40 84 L100 50" />
          <path d="M50 88 L110 54" />
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------ product mocks ------------------------------ */

function DashboardMock() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="size-2 rounded-full bg-[#3e3e44]" />
        <span className="size-2 rounded-full bg-[#3e3e44]" />
        <span className="size-2 rounded-full bg-[#3e3e44]" />
      </div>
      <div className="grid grid-cols-[200px_1fr_260px] min-h-[440px]">
        <aside className="border-r border-border/60 p-3">
          <div className="text-eyebrow mb-2 px-2 text-[10.5px]">Smart Collab</div>
          {['Inbox', 'My Issues', 'Active', 'Projects'].map((x, i) => (
            <div
              key={x}
              className={
                'flex items-center justify-between rounded-md px-2 py-1.5 text-[12px] ' +
                (i === 2 ? 'bg-card text-foreground' : 'text-muted-foreground')
              }
            >
              <span>{x}</span>
              {x === 'Inbox' && <span className="text-[10px] text-muted-foreground">4</span>}
            </div>
          ))}
          <div className="text-eyebrow mt-5 mb-2 px-2 text-[10.5px]">Workspace</div>
          {['Faster app launch', 'Onboarding revamp', 'Pricing v2'].map((p, i) => (
            <div
              key={p}
              className={
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ' +
                (i === 0 ? 'bg-card text-foreground' : 'text-muted-foreground')
              }
            >
              <span
                className="size-1.5 rounded-full"
                style={{ background: ['#5e6ad2', '#7a7fad', '#27a644'][i] }}
              />
              <span className="truncate">{p}</span>
            </div>
          ))}
        </aside>

        <div className="p-5">
          <div className="text-[14px] font-semibold tracking-tight">Faster app launch</div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">
            Drive a faster, more reliable launch experience across web and native.
          </div>
          <div className="text-eyebrow mt-5 mb-2 text-[10.5px]">Activity</div>
          <div className="flex flex-col gap-3">
            {[
              {
                u: 'Amelia',
                t: 'added 3 tasks',
                meta: 'Pricing copy · Hero rework · CTA experiments',
              },
              {
                u: 'James',
                t: 'commented on',
                meta: 'QA invitation accept flow — looks good, shipping now.',
              },
              { u: 'Kira', t: 'assigned you', meta: 'Wire up Vercel preview alias' },
              { u: 'Niloy', t: 'closed', meta: 'Ship dashboard hero' },
            ].map((row, i) => (
              <div key={i} className="flex gap-3 rounded-md border border-border/60 bg-card p-3">
                <div className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
                  {row.u[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px]">
                    <span className="font-medium">{row.u}</span>{' '}
                    <span className="text-muted-foreground">{row.t}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                    {row.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="border-l border-border/60 p-4">
          <div className="text-eyebrow mb-3 text-[10.5px]">Properties</div>
          {[
            ['Status', 'In progress', '#828fff'],
            ['Priority', 'High', '#5e6ad2'],
            ['Lead', 'Niloy R.', null],
            ['Members', '5', null],
            ['Target', 'Jun 28', null],
          ].map(([k, v, c]) => (
            <div
              key={k as string}
              className="flex items-center justify-between border-b border-border/60 py-2 text-[12px] last:border-b-0"
            >
              <span className="text-muted-foreground">{k}</span>
              <span className="flex items-center gap-1.5 text-foreground">
                {c && (
                  <span className="size-1.5 rounded-full" style={{ background: c as string }} />
                )}
                {v}
              </span>
            </div>
          ))}
          <div className="text-eyebrow mt-5 mb-3 text-[10.5px]">Cycle</div>
          <div className="rounded-md border border-border/60 bg-card p-3 text-[11.5px]">
            <div className="flex items-center justify-between">
              <span className="text-foreground">Cycle 14</span>
              <span className="text-muted-foreground">8 of 12 done</span>
            </div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-background">
              <div className="h-full w-2/3 rounded-full bg-primary" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function InboxMock() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
      <div className="grid grid-cols-[1fr_1.1fr_1fr]">
        <div className="border-r border-border/60 p-4">
          <div className="text-eyebrow mb-3 text-[10.5px]">Inbox</div>
          {[
            { who: 'Amelia', meta: 'mentioned you in Pricing copy', t: '2m', isNew: true },
            { who: 'James', meta: 'assigned QA invitation accept', t: '14m', isNew: true },
            { who: 'Kira', meta: 'invited you to Mobile app v2', t: '1h', isNew: false },
            { who: 'Niloy', meta: 'commented on Dashboard hero', t: '3h', isNew: false },
          ].map((r, i) => (
            <div
              key={i}
              className={
                'flex items-start gap-2 rounded-md p-2 text-[12px] ' + (i === 0 ? 'bg-card' : '')
              }
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[9.5px] text-primary">
                {r.who[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  <span className="font-medium">{r.who}</span>{' '}
                  <span className="text-muted-foreground">{r.meta}</span>
                </div>
                <div className="text-[10.5px] text-muted-foreground">{r.t} ago</div>
              </div>
              {r.isNew && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />}
            </div>
          ))}
        </div>
        <div className="border-r border-border/60 p-4">
          <div className="text-eyebrow mb-3 text-[10.5px]">Thread</div>
          <div className="rounded-md border border-border/60 bg-card p-3">
            <div className="text-[12.5px] font-medium">Pricing copy revisions</div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Tightening the hero copy and the Team tier subtitle. Need a final pass before
              Friday.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Marketing
              </span>
              <span className="rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                High
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {[
              { u: 'A', text: 'Draft 2 is up. Look at the Team copy.' },
              { u: 'J', text: 'Ship it. We can iterate next week.' },
            ].map((c, i) => (
              <div key={i} className="flex gap-2 text-[11.5px]">
                <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-[9.5px] text-primary">
                  {c.u}
                </span>
                <span className="text-muted-foreground">{c.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4">
          <div className="text-eyebrow mb-3 text-[10.5px]">In progress</div>
          {[
            { l: 'Pricing copy', d: 'Jun 12', s: '#828fff' },
            { l: 'Hero rework', d: 'Jun 14', s: '#5e6ad2' },
            { l: 'Vercel alias', d: 'Jun 16', s: '#62666d' },
            { l: 'Onboarding emails', d: 'Jun 18', s: '#828fff' },
          ].map((t) => (
            <div
              key={t.l}
              className="flex items-center justify-between rounded-md border-b border-border/60 px-1.5 py-2 text-[12px] last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: t.s }} />
                <span>{t.l}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{t.d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectMock() {
  const rows = [
    { l: 'Launch checklist', s: 'In progress', p: 70, c: '#828fff' },
    { l: 'Pricing v2', s: 'Planning', p: 35, c: '#5e6ad2' },
    { l: 'Mobile app v2', s: 'Backlog', p: 10, c: '#62666d' },
    { l: 'API redesign', s: 'In review', p: 85, c: '#27a644' },
    { l: 'Onboarding revamp', s: 'In progress', p: 55, c: '#828fff' },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
      <div className="grid grid-cols-[200px_1fr]">
        <aside className="border-r border-border/60 p-4">
          <div className="text-eyebrow mb-3 text-[10.5px]">Initiatives</div>
          {[
            { l: 'Core platform', a: true },
            { l: 'Growth', a: false },
            { l: 'Reliability', a: false },
            { l: 'Mobile', a: false },
          ].map((x) => (
            <div
              key={x.l}
              className={
                'mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] ' +
                (x.a ? 'bg-card text-foreground' : 'text-muted-foreground')
              }
            >
              <span className="size-1.5 rounded-full bg-primary" />
              {x.l}
            </div>
          ))}
        </aside>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-semibold tracking-tight">Core platform</div>
              <div className="mt-1 text-[11.5px] text-muted-foreground">
                12 active projects · 38 milestones · Q3 cycle
              </div>
            </div>
            <span className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground">
              New project
            </span>
          </div>
          <div className="mt-5 overflow-hidden rounded-md border border-border/60">
            <div className="grid grid-cols-[1fr_110px_140px] gap-3 border-b border-border/60 bg-card px-4 py-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">
              <span>Project</span>
              <span>Status</span>
              <span>Progress</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.l}
                className="grid grid-cols-[1fr_110px_140px] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-[12px] last:border-b-0"
              >
                <span className="truncate">{r.l}</span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-1.5 rounded-full" style={{ background: r.c }} />
                  {r.s}
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-1 w-24 overflow-hidden rounded-full bg-card">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${r.p}%`, background: r.c }}
                    />
                  </span>
                  <span className="text-[10.5px] text-muted-foreground">{r.p}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskMock() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
      <div className="grid grid-cols-[1.2fr_1fr]">
        <div className="border-r border-border/60 p-5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            <span>Hand-off</span>
          </div>
          <div className="mt-2 text-[14px] font-semibold tracking-tight">
            Stand up new email digest for invited members
          </div>
          <div className="mt-4 rounded-md border border-border/60 bg-card p-3 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
            <div>
              <span className="text-foreground">Inputs:</span> project_id, invitee_email
            </div>
            <div>
              <span className="text-foreground">Output:</span> signed accept URL + queued email
            </div>
            <div className="mt-2 text-[#828fff]">
              {'// Routes mail through resend, logs activity, returns'}
            </div>
            <div className="text-[#828fff]">{'// 201 with token expiry meta'}</div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11.5px] text-muted-foreground">
            <MessageSquare className="size-3.5" />4 comments · last 2m ago
          </div>
        </div>
        <div className="p-5">
          <div className="text-eyebrow mb-3 text-[10.5px]">Assignees</div>
          {[
            { l: 'Niloy R.', tag: 'Owner', c: '#5e6ad2' },
            { l: 'James K.', tag: 'Review', c: '#828fff' },
            { l: 'Amelia D.', tag: 'Copy', c: '#27a644' },
            { l: 'Aki S.', tag: 'QA', c: '#7a7fad' },
            { l: 'Kira P.', tag: 'Eng', c: '#5e6ad2' },
          ].map((p, i) => (
            <div
              key={p.l}
              className={
                'flex items-center justify-between rounded-md px-2 py-1.5 text-[12px] ' +
                (i === 0 ? 'bg-card' : '')
              }
            >
              <span className="flex items-center gap-2">
                <span
                  className="size-5 rounded-full"
                  style={{ background: p.c, opacity: 0.7 }}
                />
                <span>{p.l}</span>
              </span>
              <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                {p.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiffMock() {
  const left = [
    { n: 1, t: 'import { useState } from "react";', add: false },
    { n: 2, t: 'import { Button } from "@/ui/button";', add: false },
    { n: 3, t: '', add: false },
    { n: 4, t: 'export function Accept({ token }) {', add: false },
    { n: 5, t: '  const [loading, setLoading] = useState(false);', add: false },
    { n: 6, t: '  return (', add: false },
    { n: 7, t: '    <Button>Accept</Button>', add: false },
    { n: 8, t: '  );', add: false },
    { n: 9, t: '}', add: false },
  ];
  const right = [
    { n: 1, t: 'import { useState } from "react";', add: false },
    { n: 2, t: 'import { Button } from "@/ui/button";', add: false },
    { n: 3, t: 'import { acceptInvite } from "@/lib/invites";', add: true },
    { n: 4, t: '', add: false },
    { n: 5, t: 'export function Accept({ token }) {', add: false },
    { n: 6, t: '  const [loading, setLoading] = useState(false);', add: false },
    { n: 7, t: '  const onClick = () => acceptInvite(token);', add: true },
    { n: 8, t: '  return (', add: false },
    { n: 9, t: '    <Button onClick={onClick}>Accept</Button>', add: true },
    { n: 10, t: '  );', add: false },
    { n: 11, t: '}', add: false },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="font-mono">invitations/accept.tsx</span>
        <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-[10px]">+3 −0</span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border/60 font-mono text-[11px]">
        {[left, right].map((col, ci) => (
          <div key={ci} className="py-2">
            {col.map((row) => (
              <div
                key={row.n}
                className={
                  'grid grid-cols-[40px_1fr] gap-2 px-3 py-0.5 ' +
                  (row.add ? 'bg-[#27a644]/10' : '')
                }
              >
                <span className="text-right text-muted-foreground/60">{row.n}</span>
                <span className={row.add ? 'text-[#9ad4a9]' : 'text-muted-foreground'}>
                  {row.t || ' '}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PulseMock() {
  const bars = [4, 7, 5, 9, 6, 10, 8, 12, 9, 13];
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
      <div className="grid grid-cols-[1fr_1.2fr] divide-x divide-border/60">
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-medium">Weekly pulse</div>
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">
              Jun 03 – Jun 09
            </span>
          </div>
          <div className="mt-4 text-eyebrow text-[10.5px]">At a glance</div>
          <ul className="mt-2 flex flex-col gap-2.5 text-[11.5px]">
            {[
              '12 tasks completed across 3 projects',
              '5 new invitations accepted',
              'Onboarding time down 22% week-over-week',
            ].map((x) => (
              <li key={x} className="flex items-start gap-2 text-muted-foreground">
                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex h-24 items-end gap-1.5">
            {bars.map((b, i) => (
              <span
                key={i}
                className="w-3 rounded-sm"
                style={{
                  height: `${b * 7}%`,
                  background:
                    i === bars.length - 1 ? '#5e6ad2' : 'rgba(94,106,210,0.35)',
                }}
              />
            ))}
          </div>
        </div>
        <div className="p-5">
          <div className="text-[12px] font-medium">Cycle by team</div>
          <div className="mt-4 grid grid-cols-6 gap-1.5">
            {Array.from({ length: 60 }).map((_, i) => {
              const intensity = (i * 37) % 7;
              const bg =
                intensity > 5
                  ? '#5e6ad2'
                  : intensity > 3
                    ? 'rgba(94,106,210,0.55)'
                    : intensity > 1
                      ? 'rgba(94,106,210,0.25)'
                      : 'rgba(255,255,255,0.05)';
              return (
                <span key={i} className="aspect-square rounded-sm" style={{ background: bg }} />
              );
            })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] text-muted-foreground">
            <div>
              <div className="text-foreground">Eng</div>
              <div>14 cycles completed</div>
            </div>
            <div>
              <div className="text-foreground">Design</div>
              <div>9 cycles completed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
