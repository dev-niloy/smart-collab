import { defineConfig, devices } from '@playwright/test';

/**
 * Smart Collab e2e — locks the cross-tab cache-sync flow from backlog #B4.
 *
 * Assumes the dev stack is already running (backend on :4000, frontend on
 * :3000, postgres seeded). The spec logs in as the demo PM seeded from
 * `backend/prisma/seed.ts` using the DEMO_PM_PW env var.
 *
 * Run locally:
 *   1. docker compose up -d postgres
 *   2. cd backend && npm run dev
 *   3. cd frontend && npm run dev
 *   4. cd frontend && npx playwright install chromium
 *   5. cd frontend && npm run e2e
 *
 * CI wiring is a follow-up — see goal.md "Done looks like" item 7.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line']] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
