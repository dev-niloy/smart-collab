import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CircleDot,
  FolderKanban,
  Inbox,
  KeyRound,
  ListChecks,
  MessageSquare,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { MarketingShell } from '@/components/marketing/MarketingShell';

const FEATURES = [
  {
    icon: FolderKanban,
    title: 'Projects with structure',
    body: 'Organize work into projects with members, roles, and clear ownership. Invite teammates by email or pick them from a typeahead.',
  },
  {
    icon: ListChecks,
    title: 'Tasks that move',
    body: 'Status, assignees, due dates, comments, attachments. Everything you need to track work without spreadsheets.',
  },
  {
    icon: Inbox,
    title: 'A real inbox',
    body: 'Mentions, assignments, and project activity land in one place. Never miss the thread that mattered.',
  },
  {
    icon: MessageSquare,
    title: 'Threaded comments',
    body: 'Discussions stay attached to the task. @-mention to pull anyone in, with notifications that respect focus.',
  },
  {
    icon: Users,
    title: 'Roles and invitations',
    body: 'Owner, manager, member. Send signed invitation links by email — accepted in one click.',
  },
  {
    icon: Zap,
    title: 'Real-time everywhere',
    body: 'Live cache invalidation across tabs and teammates. No manual refresh, no stale state.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Create a project',
    body: 'Spin up a project in seconds. Add a description, set the owner, you’re ready.',
  },
  {
    n: '02',
    title: 'Invite your team',
    body: 'Search existing users by name or email. Send invitations to anyone else — they land in their inbox.',
  },
  {
    n: '03',
    title: 'Move tasks forward',
    body: 'Assign, comment, attach, complete. Watch the dashboard reflect reality in real time.',
  },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    pitch: 'For individuals starting out.',
    features: ['Up to 3 projects', 'Unlimited tasks', 'Email invitations', 'Community support'],
    cta: 'Get started',
    href: '/signup',
    featured: false,
  },
  {
    name: 'Team',
    price: '$12',
    cadence: 'per user / month',
    pitch: 'For teams that ship together.',
    features: [
      'Unlimited projects',
      'Roles and permissions',
      'Activity timeline',
      'Priority email support',
    ],
    cta: 'Start free trial',
    href: '/signup',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: 'talk to us',
    pitch: 'For larger orgs with controls.',
    features: ['SSO and audit logs', 'SLA and uptime', 'Custom retention', 'Dedicated CSM'],
    cta: 'Contact sales',
    href: '/contact',
    featured: false,
  },
];

const FAQ = [
  {
    q: 'Is there a free plan?',
    a: 'Yes. The Free plan is generous and never expires. Upgrade to Team when you outgrow it.',
  },
  {
    q: 'How do invitations work?',
    a: 'Invite existing users by typeahead, or email anyone — they get a signed link and join with one click.',
  },
  {
    q: 'Can I import from another tool?',
    a: 'CSV import is on the roadmap. Until then, our API and bulk-create endpoints cover most migrations.',
  },
  {
    q: 'Where is my data hosted?',
    a: 'Smart Collab runs on Vercel and managed Postgres in US-East by default. EU regions available on Enterprise.',
  },
];

export default function LandingPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-[1280px] px-6 pt-24 pb-20 md:pt-32 md:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="text-eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1">
              <Sparkles className="size-3 text-primary" />
              <span>Real-time. Opinionated. Built for teams.</span>
            </div>
            <h1 className="text-display-xl text-foreground">
              The collaboration system{' '}
              <span className="text-muted-foreground">for teams that ship.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Smart Collab is a focused project and task tracker. Projects, members, tasks,
              comments, an inbox that respects your attention — and nothing you don’t need.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className={buttonVariants({ size: 'lg' })}>Get started free
                  <ArrowRight className="ml-1 size-4" /></Link>
              <Link href="/contact" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>Talk to us</Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No credit card required. Free forever for small teams.
            </p>
          </div>

          {/* Product preview panel */}
          <div className="surface-edge-highlight mt-16 overflow-hidden rounded-2xl border border-border/70 bg-card p-3 shadow-[0_30px_90px_-30px_rgba(94,106,210,0.25)] md:p-4">
            <ProductPreview />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="max-w-2xl">
            <div className="text-eyebrow mb-3">Features</div>
            <h2 className="text-display-lg">Everything you need. Nothing you don’t.</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Most project tools bury you in surfaces. Smart Collab keeps the surface area honest —
              one canvas, one inbox, one truth.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="surface-edge-highlight group rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-border"
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

      {/* Workflow */}
      <section id="workflow" className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="text-eyebrow mb-3 inline-flex items-center gap-2">
                <Workflow className="size-3.5 text-primary" />
                Workflow
              </div>
              <h2 className="text-display-md">A loop that respects the work.</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                From the moment a task is created to the moment it ships, Smart Collab keeps
                everyone in sync — without forcing the meeting.
              </p>
              <ul className="mt-10 flex flex-col gap-7">
                {STEPS.map((s) => (
                  <li key={s.n} className="flex gap-5">
                    <div className="text-eyebrow shrink-0 text-primary">{s.n}</div>
                    <div>
                      <div className="text-[15px] font-medium tracking-tight">{s.title}</div>
                      <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
                        {s.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface-edge-highlight rounded-2xl border border-border/70 bg-card p-3">
              <WorkflowPreview />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-eyebrow mb-3">Pricing</div>
            <h2 className="text-display-lg">Honest pricing. No surprises.</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Start free. Upgrade when the team grows. Cancel any time.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={
                  'surface-edge-highlight relative flex flex-col rounded-xl border p-7 ' +
                  (tier.featured
                    ? 'border-primary/40 bg-[#141516]'
                    : 'border-border/60 bg-card')
                }
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-7 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background px-2.5 py-1 text-[11px] font-medium text-primary">
                    <CircleDot className="size-3" />
                    Most popular
                  </div>
                )}
                <div className="text-[17px] font-medium tracking-tight">{tier.name}</div>
                <p className="mt-1 text-[13px] text-muted-foreground">{tier.pitch}</p>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-[40px] font-semibold tracking-[-0.03em] leading-none">
                    {tier.price}
                  </span>
                  <span className="text-[13px] text-muted-foreground">{tier.cadence}</span>
                </div>
                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[14px]">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <Link href={tier.href} className={cn(buttonVariants({ variant: tier.featured ? 'default' : 'secondary' }), "w-full")}>{tier.cta}</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border/60">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="text-eyebrow mb-3">FAQ</div>
              <h2 className="text-display-md">Common questions.</h2>
              <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
                Can’t find what you’re looking for?{' '}
                <Link href="/contact" className="text-foreground underline-offset-4 hover:underline">
                  Drop us a line
                </Link>
                .
              </p>
            </div>
            <div className="lg:col-span-2">
              <dl className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
                {FAQ.map((row) => (
                  <div key={row.q} className="p-6">
                    <dt className="text-[15px] font-medium tracking-tight">{row.q}</dt>
                    <dd className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                      {row.a}
                    </dd>
                  </div>
                ))}
              </dl>
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
                <h2 className="text-display-md">Ship more. Argue less.</h2>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                  Bring your team onto a single canvas. Free for small teams, fast forever.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 md:justify-end">
                <Link href="/signup" className={buttonVariants({ size: 'lg' })}>Get started free
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

/* ------------------------------- product mocks ------------------------------- */

function ProductPreview() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/70 bg-background">
      {/* fake window chrome */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#3e3e44]" />
          <span className="size-2.5 rounded-full bg-[#3e3e44]" />
          <span className="size-2.5 rounded-full bg-[#3e3e44]" />
        </div>
        <div className="rounded-md border border-border/60 bg-card px-2.5 py-1 text-[11px] text-muted-foreground font-mono">
          smartcollab.app/projects/launch-q3
        </div>
        <div className="w-12" />
      </div>

      <div className="grid grid-cols-[200px_1fr] min-h-[420px]">
        {/* sidebar */}
        <aside className="border-r border-border/60 bg-background p-3">
          <div className="text-eyebrow mb-2 px-2">Workspace</div>
          <div className="flex flex-col gap-0.5">
            {[
              { l: 'Dashboard', active: false },
              { l: 'Inbox', active: false, badge: 4 },
              { l: 'Projects', active: true },
              { l: 'Profile', active: false },
            ].map((x) => (
              <div
                key={x.l}
                className={
                  'flex items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] ' +
                  (x.active
                    ? 'bg-card text-foreground'
                    : 'text-muted-foreground hover:bg-card/60')
                }
              >
                <span>{x.l}</span>
                {x.badge && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {x.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="text-eyebrow mt-5 mb-2 px-2">Projects</div>
          <div className="flex flex-col gap-0.5">
            {['Launch Q3', 'Website redesign', 'Mobile app v2'].map((p, i) => (
              <div
                key={p}
                className={
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] ' +
                  (i === 0 ? 'bg-card text-foreground' : 'text-muted-foreground')
                }
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: ['#5e6ad2', '#7a7fad', '#27a644'][i % 3] }}
                />
                <span>{p}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* main */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[18px] font-semibold tracking-tight">Launch Q3</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                12 open · 38 done · 4 in review
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {['#5e6ad2', '#27a644', '#828fff', '#7a7fad'].map((c, i) => (
                  <span
                    key={i}
                    className="size-5 rounded-full border border-background"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <span className="rounded-md border border-border/60 bg-card px-2 py-1 text-[11px] text-muted-foreground">
                Filter
              </span>
              <span className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground">
                New task
              </span>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-md border border-border/60">
            <div className="grid grid-cols-[1fr_90px_110px_70px] gap-3 border-b border-border/60 bg-card px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Task</span>
              <span>Status</span>
              <span>Assignee</span>
              <span>Due</span>
            </div>
            {[
              {
                t: 'Finalize pricing copy',
                s: 'In progress',
                sc: '#828fff',
                a: 'AM',
                d: 'Jun 12',
              },
              {
                t: 'QA invitation accept flow',
                s: 'Review',
                sc: '#5e6ad2',
                a: 'JD',
                d: 'Jun 14',
              },
              {
                t: 'Wire up Vercel preview alias',
                s: 'Todo',
                sc: '#62666d',
                a: 'NR',
                d: 'Jun 16',
              },
              {
                t: 'Write onboarding emails',
                s: 'In progress',
                sc: '#828fff',
                a: 'KP',
                d: 'Jun 18',
              },
              {
                t: 'Ship dashboard hero',
                s: 'Done',
                sc: '#27a644',
                a: 'AM',
                d: 'Jun 04',
              },
            ].map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_90px_110px_70px] items-center gap-3 border-b border-border/60 px-4 py-2.5 text-[12.5px] last:border-b-0"
              >
                <span className="truncate text-foreground">{r.t}</span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-1.5 rounded-full" style={{ background: r.sc }} />
                  {r.s}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="grid size-5 place-items-center rounded-full bg-card text-[10px] font-medium text-foreground">
                    {r.a}
                  </span>
                  <span>{r.a}</span>
                </span>
                <span className="text-muted-foreground">{r.d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background p-5">
      <div className="text-eyebrow mb-4 inline-flex items-center gap-2">
        <Inbox className="size-3.5 text-primary" />
        Inbox
      </div>
      <div className="flex flex-col divide-y divide-border/60">
        {[
          {
            who: 'Amelia',
            what: 'mentioned you',
            where: 'Finalize pricing copy',
            t: '2m',
            icon: MessageSquare,
          },
          {
            who: 'James',
            what: 'assigned',
            where: 'QA invitation accept flow',
            t: '14m',
            icon: ListChecks,
          },
          {
            who: 'Kira',
            what: 'invited you to',
            where: 'Mobile app v2',
            t: '1h',
            icon: KeyRound,
          },
          {
            who: 'Niloy',
            what: 'commented on',
            where: 'Ship dashboard hero',
            t: '3h',
            icon: MessageSquare,
          },
        ].map((row, i) => {
          const Icon = row.icon;
          return (
            <div key={i} className="flex items-start gap-3 py-3">
              <div className="mt-0.5 grid size-7 place-items-center rounded-md border border-border/60 bg-card text-primary">
                <Icon className="size-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px]">
                  <span className="text-foreground font-medium">{row.who}</span>{' '}
                  <span className="text-muted-foreground">{row.what}</span>{' '}
                  <span className="text-foreground">{row.where}</span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  Launch Q3 · {row.t} ago
                </div>
              </div>
              <span className="mt-1 size-1.5 rounded-full bg-primary" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
