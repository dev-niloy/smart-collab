import { test, expect, type Page } from '@playwright/test';

/**
 * Backlog #B4 e2e — locks two scenarios that the unit/integration suite cannot:
 *
 * 1. Same-tab refresh: PM adds a project member; the project detail header
 *    member count + the members page list both reflect the new row without
 *    a manual reload.
 * 2. Cross-tab refresh: PM is signed in on two tabs. Tab A adds a member;
 *    Tab B's task-create assignee dropdown shows the new member without a
 *    manual reload. Locks the BroadcastChannel transport added in t2.
 *
 * Seeded DB fixture is required (`backend/prisma/seed.ts` with the
 * DEMO_PM_PW env var set). The spec invites a per-run-unique throwaway
 * member account so reruns do not collide.
 */

const PM_EMAIL = 'pm@demo.local';
const DEMO_PROJECT_NAME = 'Demo Web';

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`e2e requires ${name} to be set (seeded demo password)`);
  return v;
};

const uniqueMemberEmail = (): string =>
  `e2e-member+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@demo.local`;

const signInAsPM = async (page: Page) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(PM_EMAIL);
  await page.getByLabel(/password/i).fill(requireEnv('DEMO_PM_PW'));
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/(dashboard|projects)/);
};

const openDemoProject = async (page: Page) => {
  await page.goto('/projects');
  await page.getByRole('link', { name: new RegExp(DEMO_PROJECT_NAME, 'i') }).first().click();
  await page.waitForURL(/\/projects\/[^/]+$/);
};

test.describe('member-cache-sync (backlog #B4)', () => {
  test('same-tab: header count + members list reflect add without reload', async ({ page }) => {
    await signInAsPM(page);
    await openDemoProject(page);

    const headerCountBefore = await page.getByText(/Members \(\d+\)/).innerText();
    const before = Number(headerCountBefore.match(/\((\d+)\)/)?.[1] ?? '0');

    // First seed the new member account via signup so the add-member form
    // (which expects an existing user) can resolve the email.
    const newEmail = uniqueMemberEmail();
    const newPw = 'PlaywrightTemp123!';
    await page.request.post('/api/v1/auth/signup', {
      data: { email: newEmail, password: newPw, name: 'E2E Member' },
    });

    // Back on the project page → open members → add the new member.
    await page.getByRole('link', { name: /Members/ }).click();
    await page.waitForURL(/\/projects\/[^/]+\/members$/);
    await page.getByLabel(/email/i).fill(newEmail);
    await page.getByRole('button', { name: /add/i }).click();
    await expect(page.getByText(new RegExp(`Added ${newEmail}`, 'i'))).toBeVisible();
    await expect(page.getByText(new RegExp(newEmail, 'i'))).toBeVisible();

    // Navigate back to the project detail header and confirm the count
    // bumped without a hard reload.
    await page.goBack();
    await expect(page.getByText(new RegExp(`Members \\(${before + 1}\\)`))).toBeVisible();
  });

  test('cross-tab: BroadcastChannel refreshes Tab B assignee picker', async ({ browser }) => {
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();

    await signInAsPM(tabA);
    // Tab B inherits the auth cookie via the shared context.
    await openDemoProject(tabA);
    const headerCountBefore = await tabA.getByText(/Members \(\d+\)/).innerText();
    const before = Number(headerCountBefore.match(/\((\d+)\)/)?.[1] ?? '0');
    const projectUrl = tabA.url();
    const projectId = projectUrl.split('/').pop()!;

    // Seed a fresh user account.
    const newEmail = uniqueMemberEmail();
    await tabA.request.post('/api/v1/auth/signup', {
      data: { email: newEmail, password: 'PlaywrightTemp123!', name: 'E2E Cross' },
    });

    // Tab B parks on the task-create page and opens the assignee dropdown.
    await tabB.goto(`/projects/${projectId}/tasks/new`);
    await tabB.waitForLoadState('networkidle');
    await expect(tabB.getByText(new RegExp(newEmail, 'i'))).toHaveCount(0);

    // Tab A adds the member.
    await tabA.getByRole('link', { name: /Members/ }).click();
    await tabA.waitForURL(/\/projects\/[^/]+\/members$/);
    await tabA.getByLabel(/email/i).fill(newEmail);
    await tabA.getByRole('button', { name: /add/i }).click();
    await expect(tabA.getByText(new RegExp(`Added ${newEmail}`, 'i'))).toBeVisible();

    // Tab B should refetch via BroadcastChannel — new member appears in the
    // assignable picker without a reload. Allow up to 5s for the refetch
    // to settle.
    await expect(tabB.getByText(new RegExp(newEmail, 'i'))).toBeVisible({ timeout: 5_000 });

    // And the project-detail header count in Tab A reflects the bump too.
    await tabA.goBack();
    await expect(tabA.getByText(new RegExp(`Members \\(${before + 1}\\)`))).toBeVisible();

    await context.close();
  });
});
