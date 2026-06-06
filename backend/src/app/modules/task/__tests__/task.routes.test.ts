import request from 'supertest';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { seedDemoUsers } from '../../../../../prisma/seed';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const SECRET = 'x'.repeat(40);

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

const DEMO_EMAILS = ['admin@demo.local', 'pm@demo.local', 'member@demo.local'];

const future = (days = 7) => new Date(Date.now() + days * 86_400_000).toISOString();

maybe('task routes /api/v1/tasks (t7 happy paths)', () => {
  const ORIGINAL_ENV = { ...process.env };
  let app: import('express').Express;
  let projectId: string;
  let adminId: string;
  let pmId: string;
  let memberId: string;

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

    await prisma.task.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await seedDemoUsers(prisma);

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@demo.local' } });
    const pm = await prisma.user.findUniqueOrThrow({ where: { email: 'pm@demo.local' } });
    const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@demo.local' } });
    adminId = admin.id;
    pmId = pm.id;
    memberId = member.id;

    const p = await prisma.project.create({
      data: { name: 'T7 Routes Project', deadline: new Date(future(60)), status: 'active', createdBy: adminId },
    });
    projectId = p.id;
    // C13: tasks now require assignee to be a project member (admin bypasses).
    // Add pm + member as project members so they can be assigned tasks.
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: pmId, role: 'pm' },
        { projectId, userId: memberId, role: 'member' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    await prisma.task.deleteMany({});
  });

  it('admin creates -> 201 with task + creator + assignee', async () => {
    const agent = await loginAs('admin');
    const res = await agent.post('/api/v1/tasks').send({
      projectId,
      title: 'Admin Task',
      dueDate: future(),
      assignedTo: pmId,
    });
    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('Admin Task');
    expect(res.body.task.createdBy).toBe(adminId);
    expect(res.body.task.creator).toMatchObject({ email: 'admin@demo.local' });
    expect(res.body.task.assignee).toMatchObject({ email: 'pm@demo.local' });
    expect(res.body.task.status).toBe('todo');
    expect(res.body.task.priority).toBe('medium');
  });

  it('member creates -> 201 (members can create)', async () => {
    const agent = await loginAs('team_member');
    const res = await agent.post('/api/v1/tasks').send({
      projectId,
      title: 'Member Task',
      dueDate: future(),
    });
    expect(res.status).toBe(201);
    expect(res.body.task.createdBy).toBe(memberId);
  });

  it('all roles list -> 200 + includes embedded relations', async () => {
    const adminAgent = await loginAs('admin');
    await adminAgent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Shared', dueDate: future(), assignedTo: memberId })
      .expect(201);

    for (const role of ['admin', 'project_manager', 'team_member'] as const) {
      const agent = await loginAs(role);
      const res = await agent.get(`/api/v1/tasks?projectId=${projectId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].creator).toMatchObject({ email: 'admin@demo.local' });
      expect(res.body.data[0].assignee).toMatchObject({ email: 'member@demo.local' });
    }
  });

  it('member edits own task when also self-assigned at create -> 200', async () => {
    const agent = await loginAs('team_member');
    const created = await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Own Task', dueDate: future(), assignedTo: memberId });
    expect(created.status).toBe(201);
    const res = await agent
      .patch(`/api/v1/tasks/${created.body.task.id}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');
  });

  it('member creates UNASSIGNED task → cannot edit status (PM/admin only on unassigned)', async () => {
    const agent = await loginAs('team_member');
    const created = await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Unassigned Own Task', dueDate: future() });
    expect(created.status).toBe(201);
    const res = await agent
      .patch(`/api/v1/tasks/${created.body.task.id}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TASK_WRITE_FORBIDDEN');
  });

  it('member edits task assigned to them (assignedTo=self) -> 200', async () => {
    const adminAgent = await loginAs('admin');
    const created = await adminAgent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Assigned to Member', dueDate: future(), assignedTo: memberId });
    expect(created.status).toBe(201);

    const memberAgent = await loginAs('team_member');
    const res = await memberAgent
      .patch(`/api/v1/tasks/${created.body.task.id}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
  });

  it('GET /:id returns task with creator + assignee embedded (done-criterion 5)', async () => {
    const agent = await loginAs('admin');
    const created = await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Embed check', dueDate: future(), assignedTo: memberId });
    const id = created.body.task.id;
    const res = await agent.get(`/api/v1/tasks/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.task.creator).toMatchObject({
      id: adminId,
      email: 'admin@demo.local',
      name: 'Demo Admin',
      role: 'admin',
    });
    expect(res.body.task.assignee).toMatchObject({
      id: memberId,
      email: 'member@demo.local',
      role: 'team_member',
    });
  });

  it('admin deletes -> 204; subsequent GET -> 404', async () => {
    const agent = await loginAs('admin');
    const created = await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Delete me', dueDate: future() });
    const id = created.body.task.id;
    const del = await agent.delete(`/api/v1/tasks/${id}`);
    expect(del.status).toBe(204);
    const get = await agent.get(`/api/v1/tasks/${id}`);
    expect(get.status).toBe(404);
    expect(get.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('PM deletes -> 204', async () => {
    const adminAgent = await loginAs('admin');
    const created = await adminAgent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'PM can delete', dueDate: future() });
    const pmAgent = await loginAs('project_manager');
    const res = await pmAgent.delete(`/api/v1/tasks/${created.body.task.id}`);
    expect(res.status).toBe(204);
  });

  it('list filters apply via query string (status + priority + assignedTo)', async () => {
    const agent = await loginAs('admin');
    await agent
      .post('/api/v1/tasks')
      .send({
        projectId,
        title: 'High Todo Assigned',
        dueDate: future(2),
        priority: 'high',
        assignedTo: memberId,
      })
      .expect(201);
    await agent
      .post('/api/v1/tasks')
      .send({
        projectId,
        title: 'Low Todo Unassigned',
        dueDate: future(5),
        priority: 'low',
      })
      .expect(201);

    const res = await agent.get(
      `/api/v1/tasks?projectId=${projectId}&status=todo&priority=high&assignedTo=${memberId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].priority).toBe('high');
  });

  it('list filter: status csv -> returns multi-status rows', async () => {
    const agent = await loginAs('admin');
    const res = await agent.get(
      `/api/v1/tasks?projectId=${projectId}&status=todo,in_progress`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { status: string }) =>
      ['todo', 'in_progress'].includes(t.status),
    )).toBe(true);
  });

  it('list filter: assignedTo=me resolves to authed user', async () => {
    const agent = await loginAs('team_member');
    const res = await agent.get(`/api/v1/tasks?projectId=${projectId}&assignedTo=me`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { assignedTo: string }) => t.assignedTo === memberId)).toBe(true);
  });

  it('list filter: createdBy=me resolves to authed user', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get(`/api/v1/tasks?projectId=${projectId}&createdBy=me`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { createdBy: string }) => t.createdBy === pmId)).toBe(true);
  });

  it('list filter: dueFrom + dueTo narrows date range', async () => {
    const agent = await loginAs('admin');
    await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'DueRange Task', dueDate: future(10) })
      .expect(201);
    const from = new Date(Date.now() - 1 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    const res = await agent.get(
      `/api/v1/tasks?projectId=${projectId}&dueFrom=${from}&dueTo=${to}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  // ── t8: negative paths ─────────────────────────────────────────────────────

  it('unauth -> 401 on list', async () => {
    const res = await request(app).get('/api/v1/tasks');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('unauth -> 401 on POST', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .send({ projectId, title: 'X', dueDate: future() });
    expect(res.status).toBe(401);
  });

  it('member edits task NOT assigned to them -> 403 TASK_WRITE_FORBIDDEN', async () => {
    const adminAgent = await loginAs('admin');
    const created = await adminAgent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Admin-owned', dueDate: future(), assignedTo: pmId });
    const memberAgent = await loginAs('team_member');
    const res = await memberAgent
      .patch(`/api/v1/tasks/${created.body.task.id}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TASK_WRITE_FORBIDDEN');
  });

  it('member tries DELETE of admin-created task -> 403 TASK_DELETE_FORBIDDEN (not creator)', async () => {
    const adminAgent = await loginAs('admin');
    const created = await adminAgent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Member cant delete', dueDate: future(), assignedTo: memberId });
    const memberAgent = await loginAs('team_member');
    const res = await memberAgent.delete(`/api/v1/tasks/${created.body.task.id}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('TASK_DELETE_FORBIDDEN');
  });

  it('member CAN delete their own (createdBy=self) task -> 204', async () => {
    const memberAgent = await loginAs('team_member');
    const created = await memberAgent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'My own task', dueDate: future() });
    expect(created.status).toBe(201);
    const res = await memberAgent.delete(`/api/v1/tasks/${created.body.task.id}`);
    expect(res.status).toBe(204);
  });

  it('GET unknown id -> 404 TASK_NOT_FOUND', async () => {
    const agent = await loginAs('admin');
    const res = await agent.get('/api/v1/tasks/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('PATCH unknown id (admin) -> 404 TASK_NOT_FOUND', async () => {
    const agent = await loginAs('admin');
    const res = await agent
      .patch('/api/v1/tasks/00000000-0000-0000-0000-000000000000')
      .send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('PATCH unknown id (member) -> 404 TASK_NOT_FOUND from ownership middleware', async () => {
    const agent = await loginAs('team_member');
    const res = await agent
      .patch('/api/v1/tasks/00000000-0000-0000-0000-000000000000')
      .send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('DELETE unknown id (admin) -> 404 TASK_NOT_FOUND', async () => {
    const agent = await loginAs('admin');
    const res = await agent.delete('/api/v1/tasks/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('POST invalid body -> 422 VALIDATION_ERROR', async () => {
    const agent = await loginAs('admin');
    const res = await agent
      .post('/api/v1/tasks')
      .send({ projectId: 'not-uuid', title: '', dueDate: 'bogus' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET invalid uuid in path -> 422 VALIDATION_ERROR', async () => {
    const agent = await loginAs('admin');
    const res = await agent.get('/api/v1/tasks/not-a-uuid');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH empty body -> 422 (at-least-one-field refine)', async () => {
    const adminAgent = await loginAs('admin');
    const created = await adminAgent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Empty-body target', dueDate: future() });
    const res = await adminAgent.patch(`/api/v1/tasks/${created.body.task.id}`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ── t9: e2e assessment §4 validation rules ─────────────────────────────────

  it('POST past dueDate -> 422 PAST_DEADLINE assessment-verbatim', async () => {
    const agent = await loginAs('admin');
    const res = await agent.post('/api/v1/tasks').send({
      projectId,
      title: 'Late task',
      dueDate: new Date(Date.now() - 86_400_000).toISOString(),
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAST_DEADLINE');
    expect(res.body.error.message).toBe('Please select a valid deadline.');
  });

  it('PATCH past dueDate -> 422 PAST_DEADLINE', async () => {
    const agent = await loginAs('admin');
    const created = await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Will become late', dueDate: future() });
    const res = await agent
      .patch(`/api/v1/tasks/${created.body.task.id}`)
      .send({ dueDate: new Date(Date.now() - 86_400_000).toISOString() });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAST_DEADLINE');
    expect(res.body.error.message).toBe('Please select a valid deadline.');
  });

  it('POST duplicate title in same project (case-insensitive) -> 422 DUPLICATE_TASK_TITLE assessment-verbatim', async () => {
    const agent = await loginAs('admin');
    await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Ship it', dueDate: future() })
      .expect(201);
    const res = await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'SHIP IT', dueDate: future(2) });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DUPLICATE_TASK_TITLE');
    expect(res.body.error.message).toBe('Task title already exists in this project.');
  });

  it('PATCH title to existing one in same project -> 422 DUPLICATE_TASK_TITLE', async () => {
    const agent = await loginAs('admin');
    await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'First', dueDate: future() })
      .expect(201);
    const second = await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Second', dueDate: future(2) });
    const res = await agent
      .patch(`/api/v1/tasks/${second.body.task.id}`)
      .send({ title: 'FIRST' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DUPLICATE_TASK_TITLE');
  });

  it('same title allowed in DIFFERENT project', async () => {
    const agent = await loginAs('admin');
    const otherProj = await prisma.project.create({
      data: { name: 'Other Proj', deadline: new Date(future(60)), status: 'active', createdBy: adminId },
    });
    await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Common name', dueDate: future() })
      .expect(201);
    const res = await agent
      .post('/api/v1/tasks')
      .send({ projectId: otherProj.id, title: 'Common name', dueDate: future() });
    expect(res.status).toBe(201);
    expect(res.body.task.projectId).toBe(otherProj.id);
    await prisma.project.delete({ where: { id: otherProj.id } });
  });

  it('PATCH assignedTo while status=completed -> 422 REASSIGN_COMPLETED assessment-verbatim', async () => {
    const agent = await loginAs('admin');
    const created = await agent.post('/api/v1/tasks').send({
      projectId,
      title: 'Done task',
      dueDate: future(),
      status: 'completed',
      assignedTo: adminId,
    });
    const res = await agent
      .patch(`/api/v1/tasks/${created.body.task.id}`)
      .send({ assignedTo: memberId });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REASSIGN_COMPLETED');
    expect(res.body.error.message).toBe('Cannot reassign a completed task.');
  });

  it('PATCH transitioning to completed AND reassigning in same call -> 422 REASSIGN_COMPLETED', async () => {
    const agent = await loginAs('admin');
    const created = await agent.post('/api/v1/tasks').send({
      projectId,
      title: 'In progress',
      dueDate: future(),
      status: 'in_progress',
      assignedTo: adminId,
    });
    const res = await agent
      .patch(`/api/v1/tasks/${created.body.task.id}`)
      .send({ status: 'completed', assignedTo: memberId });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REASSIGN_COMPLETED');
  });

  it('PATCH status -> completed without reassign allowed (200)', async () => {
    const agent = await loginAs('admin');
    const created = await agent.post('/api/v1/tasks').send({
      projectId,
      title: 'Finishing',
      dueDate: future(),
      status: 'in_progress',
      assignedTo: adminId,
    });
    const res = await agent
      .patch(`/api/v1/tasks/${created.body.task.id}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('completed');
  });

  describe('multi-assignee endpoints', () => {
    it('POST /:id/assignees adds an assignee (PM → 201)', async () => {
      const adminAgent = await loginAs('admin');
      const created = await adminAgent
        .post('/api/v1/tasks')
        .send({ projectId, title: 'MA-add', dueDate: future(), assigneeIds: [] });
      expect(created.status).toBe(201);
      const pmAgent = await loginAs('project_manager');
      const res = await pmAgent
        .post(`/api/v1/tasks/${created.body.task.id}/assignees`)
        .send({ userId: memberId });
      expect(res.status).toBe(201);
      expect(res.body.task.assignees).toEqual(
        expect.arrayContaining([expect.objectContaining({ userId: memberId })]),
      );
      // Legacy column dual-write set to the only assignee.
      expect(res.body.task.assignedTo).toBe(memberId);
    });

    it('POST /:id/assignees by non-PM member → 403 CANNOT_REASSIGN', async () => {
      const adminAgent = await loginAs('admin');
      const created = await adminAgent
        .post('/api/v1/tasks')
        .send({ projectId, title: 'MA-add-403', dueDate: future(), assigneeIds: [] });
      const memberAgent = await loginAs('team_member');
      const res = await memberAgent
        .post(`/api/v1/tasks/${created.body.task.id}/assignees`)
        .send({ userId: memberId });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CANNOT_REASSIGN');
    });

    it('PUT /:id/assignees replaces full list (PM → 200, exact membership)', async () => {
      const adminAgent = await loginAs('admin');
      const created = await adminAgent
        .post('/api/v1/tasks')
        .send({ projectId, title: 'MA-put', dueDate: future(), assigneeIds: [memberId] });
      const pmAgent = await loginAs('project_manager');
      const res = await pmAgent
        .put(`/api/v1/tasks/${created.body.task.id}/assignees`)
        .send({ userIds: [pmId, adminId] });
      expect(res.status).toBe(200);
      const ids = res.body.task.assignees.map((a: { userId: string }) => a.userId);
      expect(ids).toEqual(expect.arrayContaining([pmId, adminId]));
      expect(ids).not.toContain(memberId);
    });

    it('PUT /:id/assignees w/ empty list → zero assignees + legacy null', async () => {
      const adminAgent = await loginAs('admin');
      const created = await adminAgent
        .post('/api/v1/tasks')
        .send({ projectId, title: 'MA-put-empty', dueDate: future(), assigneeIds: [memberId] });
      const pmAgent = await loginAs('project_manager');
      const res = await pmAgent
        .put(`/api/v1/tasks/${created.body.task.id}/assignees`)
        .send({ userIds: [] });
      expect(res.status).toBe(200);
      expect(res.body.task.assignees).toEqual([]);
      expect(res.body.task.assignedTo).toBeNull();
    });

    it('DELETE /:id/assignees/:userId removes (PM → 200)', async () => {
      const adminAgent = await loginAs('admin');
      const created = await adminAgent
        .post('/api/v1/tasks')
        .send({ projectId, title: 'MA-del', dueDate: future(), assigneeIds: [memberId, pmId] });
      const pmAgent = await loginAs('project_manager');
      const res = await pmAgent.delete(
        `/api/v1/tasks/${created.body.task.id}/assignees/${memberId}`,
      );
      expect(res.status).toBe(200);
      const ids = res.body.task.assignees.map((a: { userId: string }) => a.userId);
      expect(ids).not.toContain(memberId);
      expect(ids).toContain(pmId);
    });
  });

  it('list pagination cap: limit=999 coerced to MAX_LIMIT=50', async () => {
    const agent = await loginAs('admin');
    await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Pag1', dueDate: future(3) })
      .expect(201);
    await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Pag2', dueDate: future(4) })
      .expect(201);
    const res = await agent.get(`/api/v1/tasks?projectId=${projectId}&limit=999`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(50);
    expect(res.body.total).toBe(2);
  });
});
