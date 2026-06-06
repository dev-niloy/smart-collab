import { test, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';

/**
 * Smoke suite for the email + realtime notification slice.
 *
 * Each test creates fresh PM + Member browser contexts (so the Member starts
 * with no unread state), uses the PM's API session to fire one trigger, and
 * asserts the Member's authed shell rail flips the inbox-unread-dot under
 * the polling fallback window — proving the SSE → react-query path for that
 * specific event type.
 *
 * Coverage matrix (mirrors the goal's "What's verified" list):
 *   - Realtime SSE push under 30s poll fallback           (all 4 trigger tests)
 *   - mention / assign / comment all wired                (4 separate tests)
 *     1. task.assigned        — addAssignee on existing task
 *     2. task.status_changed  — PATCH /tasks/:id with new status
 *     3. comment.created      — POST /tasks/:id/comments (no @mention)
 *     4. comment.mention      — POST /tasks/:id/comments with @member
 *   - Opt-out toggle works + persists                     (toggle test)
 *   - Email service pluggable via env                     (factory presence test)
 *   - BullMQ queue + worker entrypoint exist              (worker presence test)
 *
 * NOT covered here (deferred to jest):
 *   - Email actually delivered by a real provider (use EMAIL_PROVIDER=resend
 *     + a real RESEND_API_KEY + watch your inbox manually).
 *   - listGlobal end-of-data null cursor (unit-test level).
 *
 * Prereqs:
 *   - docker compose up -d           (postgres + redis)
 *   - backend dev server on :4000
 *   - frontend dev server on :3000
 *   - DEMO_PM_PW + DEMO_MEMBER_PW env vars set
 *   - DB seeded (npm --prefix backend run db:seed)
 *
 * Run headed (watch the browser):
 *   cd frontend && DEMO_PM_PW=... DEMO_MEMBER_PW=... \
 *     npx playwright test notifications-smoke --headed
 */

const PM_EMAIL = 'pm@demo.local';
const MEMBER_EMAIL = 'member@demo.local';
const DEMO_PROJECT_NAME = 'Demo Web';
const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000';

// Time we let the SSE round-trip complete in CI. Generous compared to the
// dev observation of <2s; the assertion still proves we're well under the
// 30s polling fallback that this whole slice was built to replace.
const SSE_DEADLINE_MS = 10_000;

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`e2e requires ${name} to be set`);
  return v;
};

const signIn = async (page: Page, email: string, pwEnvKey: string) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(requireEnv(pwEnvKey));
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/(dashboard|projects)/, { timeout: 10_000 });
};

const fetchMyId = async (request: APIRequestContext): Promise<string> => {
  const res = await request.get(`${API_BASE}/api/v1/users/me`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { user: { id: string } };
  return body.user.id;
};

const fetchDemoProjectId = async (request: APIRequestContext): Promise<string> => {
  const res = await request.get(`${API_BASE}/api/v1/projects?limit=50`);
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { data: { id: string; name: string }[] };
  const proj = body.data.find((p) => p.name === DEMO_PROJECT_NAME);
  if (!proj) throw new Error(`seed project ${DEMO_PROJECT_NAME} not found`);
  return proj.id;
};

const tomorrowIso = (): string => new Date(Date.now() + 86_400_000).toISOString();

// Create a fresh task in the seeded project. Assignees default to whoever
// the caller specifies; pass an empty array for the "no recipient yet"
// case (used by the comment scenarios that add the assignee themselves).
const createTask = async (
  request: APIRequestContext,
  projectId: string,
  title: string,
  assigneeIds: string[],
) => {
  const res = await request.post(`${API_BASE}/api/v1/tasks`, {
    data: {
      projectId,
      title,
      dueDate: tomorrowIso(),
      status: 'todo',
      priority: 'medium',
      assigneeIds,
    },
  });
  expect(res.ok(), `task POST failed: ${res.status()} ${await res.text()}`).toBe(true);
  return ((await res.json()) as { task: { id: string } }).task.id;
};

const openAuthedShell = async (memberPage: Page, memberCtx: BrowserContext) => {
  // Burn off any pre-existing unread state from previous runs BEFORE we
  // mount the page — that way the dashboard renders against a clean
  // inbox and the dot starts in the "not visible" state we assert on.
  // Done via the context's API session so we don't have to wait for the
  // page to be alive first.
  await memberCtx.request.post(`${API_BASE}/api/v1/notifications/read-all`);

  await memberPage.goto('/dashboard');
  await expect(memberPage.getByTestId('shell-rail')).toBeVisible();
  await expect(memberPage.getByTestId('inbox-unread-dot')).toHaveCount(0);

  // useNotificationStream connects on mount, but the EventSource handshake
  // is async — if the test trigger fires before the subscriber is attached
  // to the in-process bus the event is dropped on the floor (polling would
  // catch it 30s later, well past our SSE_DEADLINE_MS). Give the connection
  // a beat to settle. A tighter signal (waiting for the 'open' frame) would
  // need cooperation from the hook to expose its EventSource on window.
  await memberPage.waitForTimeout(1_500);
};

const expectUnreadDot = async (memberPage: Page) => {
  await expect(memberPage.getByTestId('inbox-unread-dot')).toBeVisible({
    timeout: SSE_DEADLINE_MS,
  });
};

const setupTwoSessions = async (
  browser: import('@playwright/test').Browser,
): Promise<{
  pmCtx: BrowserContext;
  memberCtx: BrowserContext;
  memberPage: Page;
  memberId: string;
  projectId: string;
}> => {
  const pmCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const pmPage = await pmCtx.newPage();
  const memberPage = await memberCtx.newPage();
  await signIn(pmPage, PM_EMAIL, 'DEMO_PM_PW');
  await signIn(memberPage, MEMBER_EMAIL, 'DEMO_MEMBER_PW');
  const memberId = await fetchMyId(memberCtx.request);
  const projectId = await fetchDemoProjectId(pmCtx.request);
  await openAuthedShell(memberPage, memberCtx);
  return { pmCtx, memberCtx, memberPage, memberId, projectId };
};

test.describe('notifications smoke — realtime SSE', () => {
  // SSE handshake + 2× sign-in + dashboard render eats ~15s on a cold dev
  // server. Bump the per-test timeout so the SSE_DEADLINE_MS still has
  // headroom for the actual event delivery assertion.
  test.setTimeout(60_000);

  test('1. task.assigned: PM creates task w/ Member as assignee', async ({ browser }) => {
    const { pmCtx, memberCtx, memberPage, memberId, projectId } = await setupTwoSessions(browser);
    try {
      await createTask(pmCtx.request, projectId, `E2E assigned ${Date.now()}`, [memberId]);
      await expectUnreadDot(memberPage);
    } finally {
      await pmCtx.close();
      await memberCtx.close();
    }
  });

  test('2. task.status_changed: PM flips status on a task Member owns', async ({ browser }) => {
    const { pmCtx, memberCtx, memberPage, memberId, projectId } = await setupTwoSessions(browser);
    try {
      // Pre-assigned to Member, but Member acks the assignment notification
      // so we're measuring the status-change SSE in isolation.
      const taskId = await createTask(
        pmCtx.request,
        projectId,
        `E2E status ${Date.now()}`,
        [memberId],
      );
      await memberCtx.request.post(`${API_BASE}/api/v1/notifications/read-all`);
      await memberPage.waitForFunction(
        async () => {
          const r = await fetch('/api/v1/notifications/unread-count', {
            credentials: 'include',
          });
          const j = (await r.json()) as { count: number };
          return j.count === 0;
        },
        { timeout: 10_000 },
      );

      const res = await pmCtx.request.patch(`${API_BASE}/api/v1/tasks/${taskId}`, {
        data: { status: 'in_progress' },
      });
      expect(res.ok(), `task PATCH failed: ${res.status()} ${await res.text()}`).toBe(true);
      await expectUnreadDot(memberPage);
    } finally {
      await pmCtx.close();
      await memberCtx.close();
    }
  });

  test('3. comment.created: PM comments on a task Member owns (no mention)', async ({ browser }) => {
    const { pmCtx, memberCtx, memberPage, memberId, projectId } = await setupTwoSessions(browser);
    try {
      const taskId = await createTask(
        pmCtx.request,
        projectId,
        `E2E comment ${Date.now()}`,
        [memberId],
      );
      await memberCtx.request.post(`${API_BASE}/api/v1/notifications/read-all`);
      await memberPage.waitForFunction(
        async () => {
          const r = await fetch('/api/v1/notifications/unread-count', {
            credentials: 'include',
          });
          const j = (await r.json()) as { count: number };
          return j.count === 0;
        },
        { timeout: 10_000 },
      );

      const res = await pmCtx.request.post(`${API_BASE}/api/v1/tasks/${taskId}/comments`, {
        data: { body: 'PM checking in — how is this going?' },
      });
      expect(res.ok(), `comment POST failed: ${res.status()} ${await res.text()}`).toBe(true);
      await expectUnreadDot(memberPage);
    } finally {
      await pmCtx.close();
      await memberCtx.close();
    }
  });

  test('4. comment.mention: PM @-mentions Member in a comment', async ({ browser }) => {
    const { pmCtx, memberCtx, memberPage, memberId, projectId } = await setupTwoSessions(browser);
    try {
      // No assignment this time — mention is the ONLY signal that should
      // produce a notification for Member.
      const taskId = await createTask(pmCtx.request, projectId, `E2E mention ${Date.now()}`, []);

      // Mention token format is `@[Label](<uuid>)` — the strict v4-shaped uuid
      // inside the parens is the only signal the parser keys off.
      const res = await pmCtx.request.post(`${API_BASE}/api/v1/tasks/${taskId}/comments`, {
        data: { body: `Hey @[Demo Member](${memberId}) please review this when you can.` },
      });
      expect(res.ok(), `mention comment failed: ${res.status()} ${await res.text()}`).toBe(true);
      await expectUnreadDot(memberPage);
    } finally {
      await pmCtx.close();
      await memberCtx.close();
    }
  });
});

test.describe('notifications smoke — opt-out + infra presence', () => {
  test('5. Member toggles emailNotifications in /profile and reload persists', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      await signIn(page, MEMBER_EMAIL, 'DEMO_MEMBER_PW');
      await page.goto('/profile');

      const toggle = page.getByRole('switch', { name: /transactional emails/i });
      await expect(toggle).toBeVisible();
      await expect(toggle).toBeEnabled();
      const wasOn = await toggle.isChecked();

      await toggle.click();
      await expect(page.getByText(/email notifications turned (on|off)\./i)).toBeVisible({
        timeout: 5_000,
      });

      await page.reload();
      const after = page.getByRole('switch', { name: /transactional emails/i });
      await expect(after).toBeVisible();
      await expect(after).toBeEnabled();
      const nowOn = await after.isChecked();
      expect(nowOn).toBe(!wasOn);

      // Restore for idempotency.
      await after.click();
      await expect(page.getByText(/email notifications turned (on|off)\./i).last()).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      await ctx.close();
    }
  });

  test('6. Email service is pluggable via EMAIL_PROVIDER (factory + impls present)', async ({
    browser: _b,
  }) => {
    // No UI surface — verifies the backend source contract that .env can
    // swap the provider implementation without code changes. Acts as a
    // canary if a future refactor removes a provider class.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const root = path.resolve(__dirname, '../../backend/src/app/modules/email');
    const factory = await fs.readFile(path.join(root, 'email.factory.ts'), 'utf8');
    expect(factory).toMatch(/EMAIL_PROVIDER/);
    expect(factory).toMatch(/StubEmailProvider/);
    expect(factory).toMatch(/ResendEmailProvider/);
    expect(factory).toMatch(/SmtpEmailProvider/);

    const provider = await fs.readFile(path.join(root, 'email.provider.ts'), 'utf8');
    expect(provider).toMatch(/class StubEmailProvider/);
    expect(provider).toMatch(/class ResendEmailProvider/);
    expect(provider).toMatch(/class SmtpEmailProvider/);
  });

  test('7. BullMQ queue + worker entrypoint exist and wire to email processor', async ({
    browser: _b,
  }) => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const backend = path.resolve(__dirname, '../../backend');
    const queue = await fs.readFile(
      path.join(backend, 'src/app/modules/email/email.queue.ts'),
      'utf8',
    );
    expect(queue).toMatch(/bullmq/);
    expect(queue).toMatch(/enqueueEmailJob/);

    const worker = await fs.readFile(path.join(backend, 'src/worker.ts'), 'utf8');
    expect(worker).toMatch(/new Worker/);
    expect(worker).toMatch(/email\.processor/);

    const pkg = JSON.parse(await fs.readFile(path.join(backend, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.scripts.worker).toMatch(/worker\.ts/);
    expect(pkg.scripts['worker:start']).toMatch(/worker\.js/);
    expect(pkg.dependencies.bullmq).toBeTruthy();
    expect(pkg.dependencies.ioredis).toBeTruthy();
  });
});
