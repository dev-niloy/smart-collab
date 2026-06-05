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
- Frontend host: Vercel
- Seed: postdeploy `prisma migrate deploy && tsx prisma/seed.ts` — idempotent
- Domain: free subdomains, no custom DNS this round
- Cookie samesite: `none` (cross-site), secure: true, only when NODE_ENV=production
- CORS allowlist: single Vercel origin, no wildcards

## Last Completed Task
t2 — CORS prod hardening: `*` stripped when NODE_ENV=production + 2 tests (cors.prod.test.ts); backend suite 523/523 (88e6d2f)

## Next Task
t3 — backend build:prod + start:prod scripts + deploy-render doc

## Session Log
- 2026-06-04: docs/plans/deploy-prod.md written — 13 tasks across A code prep / B provision / C wire+smoke / D docs+close. Discovery: backend cookies already flip samesite=none+secure when NODE_ENV=production (no fix needed), CORS already env-driven. Seed already idempotent via upsert. Smallest possible diff for actual deploy.
- 2026-06-05: phase 3 start — t1 baseline confirmed green (backend 521/521 in 31.6s, frontend 364/364 in 65.4s). Empty commit 3007665 marks pre-work baseline.
- 2026-06-05: t2 — added prod-only wildcard filter in `parseOrigins` (backend/src/app.ts) + `cors.prod.test.ts` w/ 2 tests. Full backend suite 523/523 (delta +2). Commit 88e6d2f.

## Blockers
none

## Phase Completion
- [x] Phase 1 GStack — goal.md + progress.md written
- [x] Phase 2 GSD — docs/plans/deploy-prod.md written and 13 tasks listed
- [ ] Phase 3 Superpowers — all tasks checked off, suite passing
- [ ] Phase 4 Ralph Wiggum — [DONE] output received
