# Progress — deploy-prod

## Project
- Subgoal: deploy-prod
- Started: 2026-06-04
- Last updated: 2026-06-04

## Current Phase
Phase 1 GStack complete → Phase 2 GSD next

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
Phase 1 GStack — SPEC written

## Next Task
Phase 2 GSD — slice into bite-sized tasks (per-platform setup + CORS/cookie fix + README + smoke)

## Blockers
none

## Phase Completion
- [x] Phase 1 GStack — goal.md + progress.md written
- [ ] Phase 2 GSD — docs/plans/deploy-prod.md written and all tasks listed
- [ ] Phase 3 Superpowers — all tasks checked off, suite passing
- [ ] Phase 4 Ralph Wiggum — [DONE] output received
