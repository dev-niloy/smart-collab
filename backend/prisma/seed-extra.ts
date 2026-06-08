import 'dotenv/config';
import { PrismaClient, ProjectStatus, TaskPriority, TaskStatus } from '@prisma/client';

const prisma = new PrismaClient();

const dayFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

const STATUSES: TaskStatus[] = [TaskStatus.todo, TaskStatus.in_progress, TaskStatus.completed];
const PRIORITIES: TaskPriority[] = [TaskPriority.low, TaskPriority.medium, TaskPriority.high];

const pick = <T>(arr: T[], i: number): T => arr[i % arr.length] as T;

const SMALL_PROJECTS: Array<{
  id: string;
  name: string;
  description: string;
  deadlineDays: number;
  tasks: string[];
}> = [
  {
    id: '00000000-0000-0000-0000-000000000010',
    name: 'Mobile App v2',
    description: 'Native rewrite of the customer mobile app — RN to Expo migration.',
    deadlineDays: 60,
    tasks: [
      'Audit current Expo modules',
      'Spike: native module migration plan',
      'Implement auth flow on Expo',
      'Replace Pusher w/ Ably',
      'Push notification setup (FCM)',
      'Crash reporting via Sentry',
      'CI: EAS Build profiles',
      'TestFlight + Play internal track release',
      'Onboarding screens redesign',
      'Accessibility audit pass',
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    name: 'Billing v3',
    description: 'Stripe subscription rewrite + metering + invoice PDFs.',
    deadlineDays: 90,
    tasks: [
      'Schema: subscriptions + invoices',
      'Stripe webhook handler',
      'Proration logic for upgrades',
      'Invoice PDF generator',
      'Dunning flow emails',
      'Admin dashboard: revenue widget',
      'Tax: Stripe Tax integration',
      'Legacy plan migration script',
      'Pricing page rework',
      'E2E: signup → upgrade → cancel',
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    name: 'Onboarding Revamp',
    description: 'New first-run experience for self-serve teams.',
    deadlineDays: 40,
    tasks: [
      'Define activation metric',
      'Welcome wizard component',
      'Sample data import on signup',
      'Email drip: day 0, 1, 3, 7',
      'In-app product tour',
      'Empty-state illustrations',
      'Pricing nudge at activation',
      'Telemetry hooks for funnel',
      'Beta cohort rollout',
    ],
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    name: 'Public API GA',
    description: 'Promote the v1 public API out of beta — docs, SDKs, rate limits.',
    deadlineDays: 75,
    tasks: [
      'Lock OpenAPI schema',
      'Generate TypeScript SDK',
      'Generate Python SDK',
      'Rate limiter middleware',
      'Token rotation endpoints',
      'Docs site rewrite (Mintlify)',
      'Postman collection export',
      'Public changelog',
      'Public status page',
      'Security review',
      'Pricing tiers for API',
    ],
  },
];

const SOLVEMEET_TASKS = [
  'Set up Next.js scaffold',
  'Design tokens from Linear DESIGN.md',
  'Sign-in w/ Google + email',
  'Calendar OAuth: Google + Microsoft',
  'Meeting form: title, attendees, duration',
  'Smart scheduling: availability merge',
  'Time-zone aware UI',
  'Conflict detection across calendars',
  'Round-robin assignment',
  'Buffer time enforcement',
  'Working hours rules',
  'Booking page (public, no auth)',
  'Branded booking link short codes',
  'Confirmation emails (Resend)',
  'iCal attachment in emails',
  'SMS reminders (Twilio)',
  'Reschedule + cancel flow',
  'Webhook outbound: created/canceled',
  'Zoom integration (auto-create link)',
  'Google Meet integration',
  'Teams integration',
  'Recording config + storage',
  'Notes & summary post-meeting',
  'Meeting analytics: no-show rate',
  'Team workspace: invite members',
  'Role-based access (owner / member)',
  'Stripe subscription billing',
  'Pricing page',
  'Free tier limits + paywall',
  'Affiliate link tracking',
  'Slack notifications bot',
  'Browser extension MVP',
  'Mobile app skeleton (Expo)',
  'AI: suggested meeting summaries',
  'AI: action items extraction',
  'AI: smart re-scheduling proposal',
  'Daily digest email',
  'Weekly review email',
  'Admin dashboard',
  'Audit log for meetings',
  'GDPR data export endpoint',
  'GDPR delete-my-account',
  'SOC2 type 1 prep',
  'Status page',
  'Launch landing page',
];

export const seedExtras = async (client: PrismaClient = prisma): Promise<void> => {
  const [admin, pm, member] = await Promise.all([
    client.user.findUnique({ where: { email: 'admin@demo.local' } }),
    client.user.findUnique({ where: { email: 'pm@demo.local' } }),
    client.user.findUnique({ where: { email: 'member@demo.local' } }),
  ]);
  if (!admin || !pm || !member) {
    throw new Error('Demo users missing — run prisma/seed.ts first.');
  }
  const assignees = [pm.id, member.id, admin.id];

  // ─── 4 small projects ───
  for (const p of SMALL_PROJECTS) {
    const project = await client.project.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        name: p.name,
        description: p.description,
        deadline: dayFromNow(p.deadlineDays),
        status: ProjectStatus.active,
        createdBy: pm.id,
      },
    });
    for (const userId of [pm.id, member.id]) {
      await client.projectMember.upsert({
        where: {
          project_members_project_user_unique: { projectId: project.id, userId },
        },
        update: {},
        create: {
          projectId: project.id,
          userId,
          role: userId === pm.id ? 'pm' : 'member',
          addedById: pm.id,
        },
      });
    }
    for (let i = 0; i < p.tasks.length; i++) {
      const title = p.tasks[i] as string;
      const status = pick(STATUSES, i);
      const priority = pick(PRIORITIES, i + 1);
      const assignee = pick(assignees, i);
      const created = await client.task.upsert({
        where: {
          tasks_projectId_title_unique: { projectId: project.id, title },
        },
        update: {},
        create: {
          projectId: project.id,
          title,
          description: `Auto-seeded task #${i + 1} for ${p.name}.`,
          status,
          priority,
          createdBy: pm.id,
          dueDate: dayFromNow(7 + i * 2),
        },
      });
      await client.taskAssignee.upsert({
        where: { taskId_userId: { taskId: created.id, userId: assignee } },
        update: {},
        create: { taskId: created.id, userId: assignee, addedById: pm.id },
      });
    }
  }

  // ─── Solvemeet project + 45 tasks ───
  const solvemeet = await client.project.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      name: 'Solvemeet',
      description:
        'AI-assisted meeting scheduling product. Calendar integrations, booking links, recordings, and smart automations.',
      deadline: dayFromNow(120),
      status: ProjectStatus.active,
      createdBy: pm.id,
    },
  });
  for (const userId of [pm.id, member.id, admin.id]) {
    await client.projectMember.upsert({
      where: {
        project_members_project_user_unique: { projectId: solvemeet.id, userId },
      },
      update: {},
      create: {
        projectId: solvemeet.id,
        userId,
        role: userId === pm.id ? 'pm' : 'member',
        addedById: pm.id,
      },
    });
  }
  for (let i = 0; i < SOLVEMEET_TASKS.length; i++) {
    const title = SOLVEMEET_TASKS[i] as string;
    const status = pick(STATUSES, i);
    const priority = pick(PRIORITIES, i);
    const assignee = pick(assignees, i + 2);
    const created = await client.task.upsert({
      where: {
        tasks_projectId_title_unique: { projectId: solvemeet.id, title },
      },
      update: {},
      create: {
        projectId: solvemeet.id,
        title,
        description: `Solvemeet task #${i + 1} — ${title}.`,
        status,
        priority,
        createdBy: pm.id,
        dueDate: dayFromNow(5 + i * 2),
      },
    });
    await client.taskAssignee.upsert({
      where: { taskId_userId: { taskId: created.id, userId: assignee } },
      update: {},
      create: { taskId: created.id, userId: assignee, addedById: pm.id },
    });
  }
};

const isMain = require.main === module;

if (isMain) {
  (async () => {
    try {
      await seedExtras();
      console.warn('[seed-extra] upserted small projects + Solvemeet (45 tasks)');
      await prisma.$disconnect();
    } catch (err) {
      console.error('[seed-extra] failed', err);
      await prisma.$disconnect();
      process.exit(1);
    }
  })();
}
