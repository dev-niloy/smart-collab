import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, ProjectStatus, Role, TaskPriority, TaskStatus } from '@prisma/client';

const prisma = new PrismaClient();

const dayFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

const BCRYPT_ROUNDS = 10;

type DemoUser = {
  email: string;
  name: string;
  role: Role;
  passwordEnvKey: 'DEMO_ADMIN_PW' | 'DEMO_PM_PW' | 'DEMO_MEMBER_PW';
};

const DEMO_USERS: DemoUser[] = [
  { email: 'admin@demo.local', name: 'Demo Admin', role: Role.admin, passwordEnvKey: 'DEMO_ADMIN_PW' },
  { email: 'pm@demo.local', name: 'Demo PM', role: Role.project_manager, passwordEnvKey: 'DEMO_PM_PW' },
  { email: 'member@demo.local', name: 'Demo Member', role: Role.team_member, passwordEnvKey: 'DEMO_MEMBER_PW' },
];

export const seedDemoUsers = async (client: PrismaClient = prisma): Promise<void> => {
  for (const u of DEMO_USERS) {
    const pw = process.env[u.passwordEnvKey];
    if (!pw) {
      throw new Error(`Missing required env var: ${u.passwordEnvKey}`);
    }
    const passwordHash = await bcrypt.hash(pw, BCRYPT_ROUNDS);
    await client.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
      },
    });
  }
};

/**
 * Idempotent demo data: 2 projects, members, 5 tasks covering RBAC + assignee-write smoke cases.
 * Project A "Demo Web" — PM is creator (auto-pm), Member is added → member sees it.
 * Project B "Internal Console" — PM is creator only, Member NOT added → member cannot see (RBAC #B1).
 */
export const seedDemoData = async (client: PrismaClient = prisma): Promise<void> => {
  const [admin, pm, member] = await Promise.all([
    client.user.findUnique({ where: { email: 'admin@demo.local' } }),
    client.user.findUnique({ where: { email: 'pm@demo.local' } }),
    client.user.findUnique({ where: { email: 'member@demo.local' } }),
  ]);
  if (!admin || !pm || !member) {
    throw new Error('[seed] demo users missing — run seedDemoUsers first');
  }

  // ── Project A: member is added ───────────────────────────────
  const projectA = await client.project.upsert({
    where: { id: '00000000-0000-0000-0000-00000000000a' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-00000000000a',
      name: 'Demo Web',
      description: 'Marketing site rebuild. Member is added — they see this project.',
      deadline: dayFromNow(30),
      status: ProjectStatus.active,
      createdBy: pm.id,
    },
  });
  await client.projectMember.upsert({
    where: { project_members_project_user_unique: { projectId: projectA.id, userId: pm.id } },
    update: {},
    create: { projectId: projectA.id, userId: pm.id, role: 'pm', addedById: pm.id },
  });
  await client.projectMember.upsert({
    where: { project_members_project_user_unique: { projectId: projectA.id, userId: member.id } },
    update: {},
    create: { projectId: projectA.id, userId: member.id, role: 'member', addedById: pm.id },
  });

  // ── Project B: member NOT added (RBAC isolation) ─────────────
  const projectB = await client.project.upsert({
    where: { id: '00000000-0000-0000-0000-00000000000b' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-00000000000b',
      name: 'Internal Console',
      description: 'Admin tooling. Member is NOT added — they cannot see this project.',
      deadline: dayFromNow(45),
      status: ProjectStatus.active,
      createdBy: pm.id,
    },
  });
  await client.projectMember.upsert({
    where: { project_members_project_user_unique: { projectId: projectB.id, userId: pm.id } },
    update: {},
    create: { projectId: projectB.id, userId: pm.id, role: 'pm', addedById: pm.id },
  });

  // ── Tasks in Project A ───────────────────────────────────────
  const tasks = [
    {
      title: 'Build hero section',
      desc: 'Assigned to Member — they should be able to flip status inline.',
      status: TaskStatus.todo,
      priority: TaskPriority.high,
      assignedTo: member.id,
      createdBy: pm.id,
    },
    {
      title: 'Wire up analytics',
      desc: 'Assigned to PM — Member sees it but cannot edit (read-only badge).',
      status: TaskStatus.in_progress,
      priority: TaskPriority.medium,
      assignedTo: pm.id,
      createdBy: pm.id,
    },
    {
      title: 'Design favicon',
      desc: 'Unassigned — only PM/Admin can change status.',
      status: TaskStatus.todo,
      priority: TaskPriority.low,
      assignedTo: null,
      createdBy: pm.id,
    },
    {
      title: 'Member-owned cleanup task',
      desc: 'Member is creator AND assignee — can edit + delete own.',
      status: TaskStatus.todo,
      priority: TaskPriority.medium,
      assignedTo: member.id,
      createdBy: member.id,
    },
    {
      title: 'Already shipped homepage',
      desc: 'Completed — used to verify completed badge + progress %.',
      status: TaskStatus.completed,
      priority: TaskPriority.medium,
      assignedTo: pm.id,
      createdBy: pm.id,
    },
  ];

  for (const t of tasks) {
    await client.task.upsert({
      where: { tasks_projectId_title_unique: { projectId: projectA.id, title: t.title } },
      update: {},
      create: {
        projectId: projectA.id,
        title: t.title,
        description: t.desc,
        status: t.status,
        priority: t.priority,
        assignedTo: t.assignedTo,
        createdBy: t.createdBy,
        dueDate: dayFromNow(10),
      },
    });
  }

  // ── One task in Project B (member should not see this) ──────
  await client.task.upsert({
    where: {
      tasks_projectId_title_unique: { projectId: projectB.id, title: 'Set up CI for internal tooling' },
    },
    update: {},
    create: {
      projectId: projectB.id,
      title: 'Set up CI for internal tooling',
      description: 'Member should NOT see this task in any list (RBAC scoping).',
      status: TaskStatus.todo,
      priority: TaskPriority.high,
      assignedTo: pm.id,
      createdBy: pm.id,
      dueDate: dayFromNow(15),
    },
  });
};

const isMain = require.main === module;

if (isMain) {
  (async () => {
    try {
      await seedDemoUsers();
      console.warn(`[seed] upserted ${DEMO_USERS.length} demo users`);
      await seedDemoData();
      console.warn('[seed] upserted demo projects + members + tasks');
      await prisma.$disconnect();
    } catch (err) {
      console.error('[seed] failed', err);
      await prisma.$disconnect();
      process.exit(1);
    }
  })();
}
