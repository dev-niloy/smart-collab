# Plan — deploy-prod (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/deploy-prod/goal.md`
Branch: `feature/deploy-prod` off `develop@27a116b`
Mode: brownfield · feature · new session

Each task ends with a commit (`<type>: <short>`). Mix of CODE (I edit) and MANUAL (you click). Manual tasks still commit a doc/config artifact for the next session to verify.

---

## Phase A — Code prep (backend + frontend)

### Task 1: baseline verification commit
Files: none
Steps:
- 1. Run backend + frontend suites: confirm 521/364 green
- 2. Commit `[Baseline] suites green before deploy-prod work begins`
Status: [x] 2026-06-05 — backend 521/521, frontend 364/364, empty commit 3007665

### Task 2: backend prod env audit — CORS allowlist + cookie samesite spot check
Files:
  - `backend/src/app/app.ts`
  - `backend/src/config/env.ts`
  - `backend/src/__tests__/cors.prod.test.ts` (NEW)
Steps:
- 1. Verify `CORS_ORIGINS` is comma-list parsed → array; reject `*` in prod
- 2. Spot-check `auth.cookies.ts` already flips `samesite=none + secure=true` when NODE_ENV=production (it does — locked in progress.md)
- 3. Add 2 tests: CORS rejects request from non-allowlisted origin; CORS allowlist parses comma list correctly
- 4. Commit `[A2] cors: prod allowlist hardening + 2/2`
Status: [x] 2026-06-05 — app.ts strips `*` when NODE_ENV=production; cors.prod.test.ts adds 2 tests (wildcard stripped, multi-origin comma list); full suite 523/523 (88e6d2f). env.ts untouched — already comma-parsed via zod.

### Task 3: backend Render start/build command wrapper
Files:
  - `backend/package.json`
  - `backend/docs/deploy-render.md` (NEW)
Steps:
- 1. Add `start:prod` script: `prisma migrate deploy && tsx prisma/seed.ts && node dist/server.js`
- 2. Add `build:prod` script: `prisma generate && tsc --project tsconfig.build.json`
- 3. Write `backend/docs/deploy-render.md` capturing Render service config (Build Command, Start Command, Health Check Path, env vars list — values are placeholders)
- 4. Commit `[A3] render: build:prod + start:prod scripts + deploy doc`
Status: [x] 2026-06-05 — scripts added (build:prod, start:prod); deploy-render.md captures service config + env var table (NODE_ENV, DATABASE_URL, JWT secrets, demo PWs, CORS_ORIGINS, UPLOAD_DIR=/tmp/uploads); tsc build verified. Commit 0981a24.

### Task 4: frontend prod env wiring + .env.example
Files:
  - `frontend/.env.example` (NEW or update)
  - `frontend/docs/deploy-vercel.md` (NEW)
Steps:
- 1. Document `NEXT_PUBLIC_API_URL` in `.env.example` w/ placeholder
- 2. Write `frontend/docs/deploy-vercel.md` capturing Vercel project import + env var setup (root dir = `frontend/`, framework = Next.js, install/build/output detected automatically)
- 3. Commit `[A4] vercel: .env.example + deploy doc`
Status: [x] 2026-06-05 — .env.example already had NEXT_PUBLIC_API_URL; added prod-vs-dev comment hint. deploy-vercel.md captures project import (root=frontend/, framework=Next.js auto), env var, smoke checklist, rollback. Commit 52da637. Phase A complete — pausing here, t5/t6/t7 are manual dashboard work.

## Phase B — External provisioning (MANUAL — you click; I document state)

### Task 5: Neon — provision project + capture connection string
Files:
  - `docs/goals/smart-collab/subgoals/deploy-prod/progress.md` (record Neon project id + region)
Steps:
- 1. You: sign in to neon.tech → create project `smart-collab-prod` → copy pooled connection string (DATABASE_URL)
- 2. You: paste the connection string into a local scratch (DO NOT commit) — will go into Render env in Task 6
- 3. Record in progress.md: Neon project name, region, branch=main, pool enabled
- 4. Commit `[B5] neon: project provisioned (connection string in render env only)`
Status: [ ]

### Task 6: Render — provision web service + env vars + first deploy attempt
Files:
  - `docs/goals/smart-collab/subgoals/deploy-prod/progress.md` (record Render service URL)
Steps:
- 1. You: render.com → New → Web Service → connect GitHub repo → root dir `backend/`
- 2. You: set Build Command = `npm ci && npm run build:prod` (added in t3)
- 3. You: set Start Command = `npm run start:prod` (added in t3)
- 4. You: set Health Check Path = `/healthz`
- 5. You: set env vars: `NODE_ENV=production`, `DATABASE_URL=<neon>`, `JWT_ACCESS_SECRET=<40-char random>`, `JWT_REFRESH_SECRET=<different 40-char random>`, `ACCESS_TOKEN_TTL=15m`, `REFRESH_TOKEN_TTL=7d`, `DEMO_ADMIN_PW=<random>`, `DEMO_PM_PW=<random>`, `DEMO_MEMBER_PW=<random>`, `CORS_ORIGINS=<will fill after vercel>`, `COOKIE_DOMAIN=` (empty), `UPLOAD_DIR=/tmp/uploads`
- 6. You: first deploy. Build runs prisma generate + tsc. Start runs migrate deploy + seed + node.
- 7. Record service URL in progress.md
- 8. Commit `[B6] render: service provisioned + first deploy logs captured`
Status: [ ]

### Task 7: Vercel — provision project + env vars + first deploy
Files:
  - `docs/goals/smart-collab/subgoals/deploy-prod/progress.md` (record Vercel URL)
Steps:
- 1. You: vercel.com → import repo → root `frontend/`
- 2. You: env var `NEXT_PUBLIC_API_URL=<render url from t6>`
- 3. You: deploy. Wait for green.
- 4. Record Vercel URL in progress.md
- 5. Commit `[B7] vercel: project provisioned + first deploy URL captured`
Status: [ ]

## Phase C — Wire up CORS + smoke

### Task 8: backend — set CORS_ORIGINS to actual Vercel URL + redeploy
Files:
  - `docs/goals/smart-collab/subgoals/deploy-prod/progress.md`
Steps:
- 1. You: in Render dashboard, set CORS_ORIGINS = `https://<vercel-url>` (the one from t7)
- 2. You: manual redeploy or wait for next push
- 3. Verify `curl -i https://<vercel-url>` returns 200 from frontend
- 4. Verify `curl -i https://<render-url>/healthz` returns 200
- 5. Commit `[C8] cors: prod CORS_ORIGINS wired to vercel origin`
Status: [ ]

### Task 9: smoke verification — Demo Login flow end-to-end (incognito)
Files:
  - `docs/goals/smart-collab/subgoals/deploy-prod/progress.md` (smoke log)
Steps:
- 1. Open incognito → navigate to Vercel URL
- 2. Click Demo Login → Admin. Verify dashboard loads, header shows email, role chip = Admin
- 3. Logout. Demo Login → Project Manager. Verify
- 4. Logout. Demo Login → Team Member. Verify
- 5. Create a project. Create a task. Open task detail. Post a comment. Upload a small file. Verify NotificationBell appears (badge=0 since same user assigned themselves)
- 6. Open Network tab: confirm cookies set w/ `samesite=none; secure; httponly`; confirm `Access-Control-Allow-Origin` matches Vercel URL exactly
- 7. Record smoke results in progress.md w/ pass/fail per check
- 8. Commit `[C9] smoke: incognito flow verified across 3 roles`
Status: [ ]

## Phase D — Documentation + close

### Task 10: README — append §Deployment section
Files:
  - `README.md`
Steps:
- 1. Add §Deployment section: live URLs (frontend + backend), demo creds (admin/pm/member emails + note "password environment-injected, see hosted dashboards"), backend deploy steps (Render config), frontend deploy steps (Vercel config), DB (Neon), env-var table
- 2. Add §Demo section near top w/ live URL + click-this-to-try copy
- 3. Commit `[D10] readme: append deployment + demo sections`
Status: [ ]

### Task 11: parent goal.md — flip "Live URL" criterion to met
Files:
  - `docs/goals/smart-collab/goal.md` (parent)
  - `docs/goals/smart-collab/progress.md` (parent)
Steps:
- 1. Append session log line to parent progress.md w/ live URLs + completion date
- 2. No edit to parent goal.md done-criteria list itself (still describes target); mark in parent progress.md
- 3. Commit `[D11] parent: log smart-collab assessment complete via deploy-prod`
Status: [ ]

### Task 12: final CI green + state.yaml + progress.md close
Files:
  - `docs/goals/smart-collab/subgoals/deploy-prod/state.yaml`
  - `docs/goals/smart-collab/subgoals/deploy-prod/progress.md`
Steps:
- 1. Confirm CI green on the PR (backend test, backend typecheck, backend lint, frontend test, frontend typecheck, frontend lint — all pass)
- 2. Flip state.yaml `phase: 3`, `superpowers: true`
- 3. Update progress.md Last Completed Task + Next Task (Phase 4 Ralph)
- 4. Commit `[D12] deploy-prod: phase 3 superpowers complete`
Status: [ ]

### Task 13: open PR feature/deploy-prod → develop
Files: none (PR description in GitHub)
Steps:
- 1. (USER PERMISSION) push branch
- 2. (USER PERMISSION) open PR via gh w/ template body
- 3. CI must pass
- 4. Decide: merge to develop only? Or develop → main next?
Status: [ ]

---

## Notes on scope discipline
- All "manual" tasks (5/6/7/8/9) commit a docs artifact even when no code changes — so the audit trail stays linear, no silent dashboard work
- t11 only touches PARENT goal docs, not extras-polish or earlier subgoals
- Ralph Wiggum (phase 4) will likely be a single-iter no-op pass since this is mostly config; no need to invent issues
