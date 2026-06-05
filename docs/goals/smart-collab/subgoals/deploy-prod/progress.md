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
- Frontend host: Vercel
- Seed: postdeploy `prisma migrate deploy && tsx prisma/seed.ts` — idempotent
- Domain: free subdomains, no custom DNS this round
- Cookie samesite: `none` (cross-site), secure: true, only when NODE_ENV=production
- CORS allowlist: single Vercel origin, no wildcards

## Last Completed Task
t5 — Neon `smart-collab-prod` provisioned, region us-east-1, branch main, pooled. Metadata logged; connection string out-of-repo.

## Next Task
t6 — MANUAL: Render provision web service + env vars + first deploy. Needs user account login on render.com.

## Session Log
- 2026-06-04: docs/plans/deploy-prod.md written — 13 tasks across A code prep / B provision / C wire+smoke / D docs+close. Discovery: backend cookies already flip samesite=none+secure when NODE_ENV=production (no fix needed), CORS already env-driven. Seed already idempotent via upsert. Smallest possible diff for actual deploy.
- 2026-06-05: phase 3 start — t1 baseline confirmed green (backend 521/521 in 31.6s, frontend 364/364 in 65.4s). Empty commit 3007665 marks pre-work baseline.
- 2026-06-05: t2 — added prod-only wildcard filter in `parseOrigins` (backend/src/app.ts) + `cors.prod.test.ts` w/ 2 tests. Full backend suite 523/523 (delta +2). Commit 88e6d2f.
- 2026-06-05: t3 — package.json scripts: `build:prod` = `prisma generate && tsc`, `start:prod` = `migrate deploy && seed && node dist/server.js`. deploy-render.md captures: root=backend/, build=`npm ci --include=dev && npm run build:prod`, start=`npm run start:prod`, health=/healthz, full env var table. tsx stays devDep — Render image keeps devDeps from build install into runtime. Commit 0981a24.
- 2026-06-05: refactor — start:prod now reuses existing `db:migrate:deploy` + `db:seed` scripts (DRY). Commit 6efe516.
- 2026-06-05: t4 — frontend/.env.example expanded w/ dev vs Vercel-prod comments; frontend/docs/deploy-vercel.md added (root=frontend/, framework auto-detected, single env var NEXT_PUBLIC_API_URL, smoke + rollback steps). Commit 52da637. PHASE A CODE PREP COMPLETE — pausing per plan; t5/t6/t7/t8/t9 are user dashboard work.
- 2026-06-05: t5 — Neon project `smart-collab-prod` provisioned, AWS us-east-1, branch main, pooled. Endpoint id `ep-silent-rice-apip84iz` (non-secret). Connection string held by user, will be set as Render `DATABASE_URL` only. SECURITY: initial password pasted in chat → must rotate via Neon Roles before any public traffic, then update Render env.

## Blockers
none

## Phase Completion
- [x] Phase 1 GStack — goal.md + progress.md written
- [x] Phase 2 GSD — docs/plans/deploy-prod.md written and 13 tasks listed
- [ ] Phase 3 Superpowers — all tasks checked off, suite passing
- [ ] Phase 4 Ralph Wiggum — [DONE] output received
