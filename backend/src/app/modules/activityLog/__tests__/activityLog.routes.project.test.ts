import request from 'supertest';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { seedDemoUsers } from '../../../../../prisma/seed';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const SECRET = 'x'.repeat(40);
const DEMO_EMAILS = ['admin@demo.local', 'pm@demo.local', 'member@demo.local'];
const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

const setupEnv = () => {
  Object.assign(process.env, {
    JWT_ACCESS_SECRET: SECRET,
    JWT_REFRESH_SECRET: SECRET + 'r',
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL: '7d',
    DEMO_ADMIN_PW: 'demo-admin-pw',
    DEMO_PM_PW: 'demo-pm-pw',
    DEMO_MEMBER_PW: 'demo-member-pw',
    CORS_ORIGINS: 'http://localhost:3000',
    COOKIE_DOMAIN: '',
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: 'test',
  });
};

maybe('activity routes (per-project)', () => {
  let app: import('express').Express;
  let pmId: string;
  let projectId: string;
  let otherProjectId: string;

  const loginAs = async (role: 'admin' | 'project_manager' | 'team_member') => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/demo-login').send({ role });
    expect(res.status).toBe(200);
    return agent;
  };

  beforeAll(async () => {
    setupEnv();
    jest.resetModules();
    const mod = await import('../../../../app');
    app = mod.default;

    await prisma.activityLog.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await seedDemoUsers(prisma);

    const pm = await prisma.user.findUniqueOrThrow({ where: { email: 'pm@demo.local' } });
    pmId = pm.id;

    const p = await prisma.project.create({
      data: { name: `act-rt-p-${Date.now()}`, deadline: future(30), createdBy: pmId },
    });
    projectId = p.id;
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: pmId, role: 'pm' },
        // memberId NOT added to this project — used to test 403
      ],
    });

    const other = await prisma.project.create({
      data: { name: `act-rt-other-${Date.now()}`, deadline: future(30), createdBy: pmId },
    });
    otherProjectId = other.id;
    await prisma.projectMember.create({ data: { projectId: otherProjectId, userId: pmId, role: 'pm' } });

    for (let i = 0; i < 12; i++) {
      await prisma.activityLog.create({
        data: {
          actorId: pmId,
          action: 'task.created',
          entityType: 'task',
          entityId: projectId,
          projectId,
          meta: { title: `S${i}` },
        },
      });
      await new Promise((r) => setTimeout(r, 2));
    }
    await prisma.activityLog.create({
      data: {
        actorId: pmId,
        action: 'project.created',
        entityType: 'project',
        entityId: otherProjectId,
        projectId: otherProjectId,
      },
    });
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await disconnectPrisma();
  });

  it('200 for project member (pm)', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get(`/api/v1/projects/${projectId}/activity`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('200 for admin (project role bypass)', async () => {
    const agent = await loginAs('admin');
    const res = await agent.get(`/api/v1/projects/${projectId}/activity`);
    expect(res.status).toBe(200);
  });

  it('403 FORBIDDEN_PROJECT_ROLE for non-member', async () => {
    const agent = await loginAs('team_member');
    const res = await agent.get(`/api/v1/projects/${projectId}/activity`);
    expect(res.status).toBe(403);
  });

  it('404 PROJECT_NOT_FOUND for missing id (admin bypasses RBAC, hits controller check)', async () => {
    const agent = await loginAs('admin');
    const res = await agent.get(`/api/v1/projects/00000000-0000-0000-0000-000000000000/activity`);
    expect(res.status).toBe(404);
  });

  it('filters items to that project only', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get(`/api/v1/projects/${projectId}/activity?limit=50`);
    expect(res.status).toBe(200);
    expect(res.body.items.every((i: { projectId: string }) => i.projectId === projectId)).toBe(true);
  });

  it('pagination works on nested route', async () => {
    const agent = await loginAs('project_manager');
    const p1 = await agent.get(`/api/v1/projects/${projectId}/activity?limit=5`);
    expect(p1.body.nextCursor).not.toBeNull();
    const p2 = await agent.get(`/api/v1/projects/${projectId}/activity?limit=5&cursor=${encodeURIComponent(p1.body.nextCursor)}`);
    expect(p2.status).toBe(200);
    const overlap = p2.body.items.filter((i: { id: string }) =>
      p1.body.items.some((p: { id: string }) => p.id === i.id),
    );
    expect(overlap.length).toBe(0);
  });
});
