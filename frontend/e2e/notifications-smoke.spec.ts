import { test, expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';

/**
 * Smoke test for the email + realtime notification slice.
 *
 * What it asserts:
 *   1. SSE delivery: PM assigns a task to Member; the Member's shell rail
 *      shows the unread dot within a few seconds, well under the 30s poll
 *      cadence — proving the EventSource → react-query invalidate path.
 *   2. /profile opt-out toggle: Member flips emailNotifications off, sees a
 *      toast, reloads, sees the switch still unchecked — proving the PATCH
 *      /users/me wire-up + server persistence.
 *
 * The test does NOT assert real email delivery. The stub provider is used
 * (default), and the worker process is optional — the SSE path does not
 * depend on the email queue. To smoke-test real delivery, run the worker
 * + flip EMAIL_PROVIDER=resend in .env, then watch your inbox manually.
 *
 * Prereqs (mirrors member-cache-sync.spec.ts):
 *   - docker compose up -d         # postgres + redis (redis optional here)
 *   - backend dev server on :4000
 *   - frontend dev server on :3000
 *   - DEMO_PM_PW + DEMO_MEMBER_PW env vars set (from .env)
 *   - DB seeded (npm --prefix backend run db:seed)
 *
 * Run:
 *   cd frontend && npm run e2e -- notifications-smoke
 */

const PM_EMAIL = 'pm@demo.local';
const MEMBER_EMAIL = 'member@demo.local';
const DEMO_PROJECT_NAME = 'Demo Web';
const API_BASE = process.env.E2E_API_URL ?? 'http://localhost:4000';

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

// Resolve the signed-in user's id via /users/me — needed by the PM session
// to enqueue a task assignment targeting the Member.
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

test.describe('notifications smoke', () => {
  test('SSE pushes unread dot to Member when PM assigns a task', async ({ browser }) => {
    // Two isolated browser contexts simulate PM + Member tabs.
    const pmCtx = await browser.newContext();
    const memberCtx = await browser.newContext();
    try {
      const pmPage = await pmCtx.newPage();
      const memberPage = await memberCtx.newPage();

      await signIn(pmPage, PM_EMAIL, 'DEMO_PM_PW');
      await signIn(memberPage, MEMBER_EMAIL, 'DEMO_MEMBER_PW');

      // Member needs to be on an authed page so AuthedLayout mounts
      // useNotificationStream() and the EventSource is live.
      await memberPage.goto('/dashboard');
      await expect(memberPage.getByTestId('shell-rail')).toBeVisible();
      // Sanity: starts with no unread dot.
      await expect(memberPage.getByTestId('inbox-unread-dot')).toHaveCount(0);

      // PM identifies project + member id via API using the PM session cookies.
      const memberId = await fetchMyId(memberCtx.request);
      const projectId = await fetchDemoProjectId(pmCtx.request);

      const title = `E2E SSE smoke ${Date.now()}`;
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
      const createRes = await pmCtx.request.post(`${API_BASE}/api/v1/tasks`, {
        data: {
          projectId,
          title,
          dueDate: tomorrow,
          status: 'todo',
          priority: 'medium',
          assigneeIds: [memberId],
        },
      });
      expect(createRes.ok(), `task POST failed: ${createRes.status()} ${await createRes.text()}`).toBe(true);

      // The SSE path SHOULD push the unread badge in well under the 30s
      // polling fallback. We allow 10s to absorb CI jitter.
      await expect(memberPage.getByTestId('inbox-unread-dot')).toBeVisible({ timeout: 10_000 });
    } finally {
      await pmCtx.close();
      await memberCtx.close();
    }
  });

  test('Member can toggle emailNotifications off in /profile', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      await signIn(page, MEMBER_EMAIL, 'DEMO_MEMBER_PW');

      await page.goto('/profile');
      const toggle = page.getByRole('switch', { name: /transactional emails/i });
      await expect(toggle).toBeVisible();
      // The toggle is disabled until useUser resolves + emailNotificationsLocal
      // hydrates from the server value. Wait for that before reading state.
      await expect(toggle).toBeEnabled();

      // Capture starting state, flip it, expect a toast.
      const wasOn = await toggle.isChecked();
      await toggle.click();
      await expect(
        page.getByText(/email notifications turned (on|off)\./i),
      ).toBeVisible({ timeout: 5_000 });

      // Persistence check: reload, fresh /users/me, switch reflects new state.
      await page.reload();
      const after = page.getByRole('switch', { name: /transactional emails/i });
      await expect(after).toBeVisible();
      await expect(after).toBeEnabled();
      const nowOn = await after.isChecked();
      expect(nowOn).toBe(!wasOn);

      // Restore the original state so reruns are idempotent.
      await after.click();
      await expect(
        page.getByText(/email notifications turned (on|off)\./i).last(),
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await ctx.close();
    }
  });
});
