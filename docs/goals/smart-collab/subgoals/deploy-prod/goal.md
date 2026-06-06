# Goal — deploy-prod (subgoal)

Parent: `smart-collab` (assessment app)
Branch: `feature/deploy-prod` off `develop`
Mode: brownfield · feature · new session

---

## What
Get the app on the public internet. Vercel for the Next.js frontend, Render for the Express backend, Neon for managed Postgres. Seed runs automatically on every backend deploy so demo users (admin/pm/member) are always present.

## Why
Parent `goal.md` done-criteria #1 says "Live URL reachable from clean browser". Without it the assessment grader cannot verify behavior — code-complete but not submittable. This subgoal unblocks submission.

## Done looks like
1. Frontend lives at `https://<app>.vercel.app` — auto-deploys on push to `main`
2. Backend lives at `https://<app>-api.onrender.com` — auto-deploys on push to `main`; postdeploy runs `prisma migrate deploy && tsx prisma/seed.ts`
3. Postgres on Neon — connection string lives in Render env only; never committed
4. Demo Login button works for all 3 roles from the deployed frontend in a fresh incognito session
5. CORS allows the Vercel origin only — no `*`
6. Refresh-token cookie set `secure; httponly; samesite=none` (cross-site cookie) — auth survives Vercel ↔ Render hop
7. Health endpoint `/healthz` returns 200 on the live URL
8. README updated with: live URL, demo creds, deploy steps for backend + frontend + DB, env-var table
9. Backend baseline suite still 521/521 in CI on the deploy branch
10. Frontend baseline still 364/364 in CI on the deploy branch

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Locked decisions (Phase 1 clarifications)
- **Backend host:** Render (free web service, cold-start tolerated)
- **Postgres host:** Neon (serverless free tier, decoupled from backend host)
- **Frontend host:** Vercel (default Next.js)
- **Seed strategy:** auto-run on every backend deploy via postdeploy hook; existing `prisma/seed.ts` is idempotent
- **Domain:** free subdomains `*.vercel.app` + `*.onrender.com` — no custom domain this round

## Constraints (brownfield)
- MUST NOT alter existing API response shapes
- MUST NOT regress backend 521 / frontend 364 test counts
- MUST NOT commit `.env`, Neon connection string, JWT secrets, or `DEMO_*_PW` values
- MUST keep all 3 demo passwords environment-injected (already are) — production values different from local dev defaults
- MUST gate CORS to the exact deployed Vercel origin — no wildcards, no localhost in prod
- MUST flip refresh-cookie `samesite` from `lax` (dev) to `none` only when in prod, and only with `secure: true`
- MUST run prisma migrate deploy (NOT migrate dev) in CI / postdeploy — never apply unverified schema changes against prod
- MUST NOT push the deploy commit to `main` until staging on `develop` is green + smoke-tested

## Scope of this subgoal
- IN: Render service config, Vercel project config, Neon project + connection string, postdeploy seed hook, CORS prod fix, cookie samesite prod fix, README deploy section, env-var documentation, smoke verification from incognito
- OUT: custom domain, CDN config, log aggregation (Datadog/Logtail), error tracking (Sentry), uptime monitoring, db backups beyond Neon's default, autoscaling, multi-region

## Existing Tests
- Backend jest: 521/521 baseline
- Frontend vitest: 364/364 baseline
- Coverage: `--coverage` flag both apps

## Acceptance Criteria
Items 1–10 above. Verified by curl + incognito browser session against the live URLs, not localhost.
