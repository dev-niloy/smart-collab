# Progress — deploy-prod

## Project
- Subgoal: deploy-prod
- Started: 2026-06-04
- Last updated: 2026-06-05

## Current Phase
Phase 3 Superpowers in progress — t1 done, next t2

## Session Log
- 2026-06-04: branched `feature/deploy-prod` off `develop@27a116b`. Clarifications gathered: Render backend, Neon Postgres, auto-seed on deploy, free subdomains. goal.md written w/ 10 done-criteria + brownfield constraints.

## Locked decisions
- Backend host: Render (free web service, ~30s cold start accepted)
- Postgres host: Neon (decoupled, 10GB free tier, branching usable for future)

## Neon project (t5 — provisioned 2026-06-05)
- Project name: `smart-collab-prod`
- Region: AWS US East 1 (N. Virginia) — `us-east-1`
- Branch: `main`
- Pool: enabled (`-pooler` host)
- Endpoint id: `ep-silent-rice-apip84iz` (host metadata only — non-secret)
- Connection string: stored OUT-OF-REPO. Goes into Render env `DATABASE_URL` only.
- SECURITY NOTE: initial password was pasted in chat on 2026-06-05 — MUST rotate via Neon → Roles before public traffic. Update Render env after rotation.

## Vercel project (t7 — provisioned 2026-06-05)
- Project id: `prj_AjqpWRhOG0M5HYITk7v8lbuGLVMj`
- Name: `smart-collab`
- Team: `niloy-roys-projects-2defd7be`
- Root dir: `frontend`
- Production URL (stable): https://smart-collab-niloy-roys-projects-2defd7be.vercel.app
- Env: `NEXT_PUBLIC_API_URL=https://smart-collab-api.onrender.com` (production + preview)
- Build fix landed: Suspense wrap on `useSearchParams` pages (commit 04439ed) + drop redundant vercel.json (9a96081)
- Deployment Protection: disabled by user after first prod deploy
- Deployed via Vercel CLI (`vercel deploy --prod`) from local; project linked to GitHub for future auto-deploys from develop

## CORS wiring (t8 — 2026-06-05)
- `CORS_ORIGINS` set in Render via MCP `update_environment_variables` to Vercel stable URL
- Auto-redeploy `dep-d8h4inb7uimc73ci0hd0` (live in 58s)
- Verified: `curl -H "Origin: <vercel>" /healthz` echoes ACAO; `curl -H "Origin: https://evil.test"` omits ACAO

## Render service (t6 — provisioned 2026-06-05)
- Service id: `srv-d8h3jat8nd3s73bpuv30`
- Name: `smart-collab-api`
- Region: virginia (closest to Neon us-east-1)
- Plan: free
- Watches branch: `develop`
- URL: https://smart-collab-api.onrender.com
- Live deploy commit: `0b15ac9` (PR #19)
- Failures resolved en route: dist path (14b6f36 / PR #18), CORS_ORIGINS required (17857a3 / PR #19)
- `/healthz` verified 200 via curl 2026-06-05
- Frontend host: Vercel
- Seed: postdeploy `prisma migrate deploy && tsx prisma/seed.ts` — idempotent
- Domain: free subdomains, no custom DNS this round
- Cookie samesite: `none` (cross-site), secure: true, only when NODE_ENV=production
- CORS allowlist: single Vercel origin, no wildcards

## Last Completed Task
t9–t12 — incognito smoke passed across 3 demo roles on https://smart-collab-liard.vercel.app. README + parent log updated. Subgoal Phase 3 complete.

## Next Task
t13 — USER PERMISSION: open PR develop → main (or merge develop into main directly per ship preference).

## Session Log
- 2026-06-04: docs/plans/deploy-prod.md written — 13 tasks across A code prep / B provision / C wire+smoke / D docs+close. Discovery: backend cookies already flip samesite=none+secure when NODE_ENV=production (no fix needed), CORS already env-driven. Seed already idempotent via upsert. Smallest possible diff for actual deploy.
- 2026-06-05: phase 3 start — t1 baseline confirmed green (backend 521/521 in 31.6s, frontend 364/364 in 65.4s). Empty commit 3007665 marks pre-work baseline.
- 2026-06-05: t2 — added prod-only wildcard filter in `parseOrigins` (backend/src/app.ts) + `cors.prod.test.ts` w/ 2 tests. Full backend suite 523/523 (delta +2). Commit 88e6d2f.
- 2026-06-05: t3 — package.json scripts: `build:prod` = `prisma generate && tsc`, `start:prod` = `migrate deploy && seed && node dist/server.js`. deploy-render.md captures: root=backend/, build=`npm ci --include=dev && npm run build:prod`, start=`npm run start:prod`, health=/healthz, full env var table. tsx stays devDep — Render image keeps devDeps from build install into runtime. Commit 0981a24.
- 2026-06-05: refactor — start:prod now reuses existing `db:migrate:deploy` + `db:seed` scripts (DRY). Commit 6efe516.
- 2026-06-05: t4 — frontend/.env.example expanded w/ dev vs Vercel-prod comments; frontend/docs/deploy-vercel.md added (root=frontend/, framework auto-detected, single env var NEXT_PUBLIC_API_URL, smoke + rollback steps). Commit 52da637. PHASE A CODE PREP COMPLETE — pausing per plan; t5/t6/t7/t8/t9 are user dashboard work.
- 2026-06-05: t5 — Neon project `smart-collab-prod` provisioned, AWS us-east-1, branch main, pooled. Endpoint id `ep-silent-rice-apip84iz` (non-secret). Connection string held by user, will be set as Render `DATABASE_URL` only. SECURITY: initial password pasted in chat → must rotate via Neon Roles before any public traffic, then update Render env.
- 2026-06-05: t6 — Render service `smart-collab-api` (srv-d8h3jat8nd3s73bpuv30) provisioned via blueprint. Three deploys: 4b5173d update_failed (MODULE_NOT_FOUND on dist/server.js), e7accc2 update_failed (CORS_ORIGINS Required), 0b15ac9 LIVE. URL https://smart-collab-api.onrender.com; /healthz returns 200. Two follow-up PRs landed (#18 path fix, #19 CORS default).
- 2026-06-05: t7 — Vercel project `smart-collab` (prj_AjqpWRhOG0M5HYITk7v8lbuGLVMj) linked + deployed via CLI. First prod deploy failed: useSearchParams pages need Suspense (commit 04439ed). Also dropped redundant frontend/vercel.json (vercel.ts owns config; commit 9a96081). Deployment Protection toggled OFF by user. Stable prod URL https://smart-collab-niloy-roys-projects-2defd7be.vercel.app.
- 2026-06-05: t8 — `CORS_ORIGINS` set in Render via MCP to Vercel URL. Auto-redeploy `dep-d8h4inb7uimc73ci0hd0` live in 58s. Origin echo verified positive (Vercel) and negative (evil.test).
- 2026-06-05: post-t8 follow-ups: (a) CORS_ORIGINS expanded to include `smart-collab-liard.vercel.app` (public alias) alongside team-scoped alias. (b) PR #21 trim COOKIE_DOMAIN whitespace + relax schema default — fix "option domain is invalid" cookie crash. (c) PR #22 Next.js rewrite `/api/:path*` → backend, frontend api base relative — makes auth cookies first-party so modern browsers stop dropping them. (d) Vercel project Production Branch flipped to `develop`; auto-promote now works.
- 2026-06-05: t9 — incognito smoke PASS across 3 demo roles on https://smart-collab-liard.vercel.app. Cookies first-party w/ Secure+HttpOnly+SameSite=None. No CORS blocks. Same-origin /api/* proxy via Next rewrite confirmed working.
- 2026-06-05: t10 — README expanded w/ live URLs, demo table, deployment table (Vercel/Render/Neon), required env var tables.
- 2026-06-05: t11–t12 — Phase 3 marked complete in state.yaml; subgoal ready for t13 (main promotion gate).

## Blockers
none

## Phase Completion
- [x] Phase 1 GStack — goal.md + progress.md written
- [x] Phase 2 GSD — docs/plans/deploy-prod.md written and 13 tasks listed
- [ ] Phase 3 Superpowers — all tasks checked off, suite passing
- [ ] Phase 4 Ralph Wiggum — [DONE] output received
