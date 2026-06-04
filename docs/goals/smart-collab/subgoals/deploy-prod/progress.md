# Progress — deploy-prod

## Project
- Subgoal: deploy-prod
- Started: 2026-06-04
- Last updated: 2026-06-04

## Current Phase
Phase 2 GSD complete → Phase 3 Superpowers next

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
Phase 2 GSD — 13 tasks sliced (4 code, 5 manual external, 4 docs/close)

## Next Task
Phase 3 Superpowers — execute t1 (baseline) then run t2/t3/t4 (code prep). After t4, pause: t5/t6/t7 are manual dashboard work (Neon, Render, Vercel) that needs the user at a keyboard.

## Session Log
- 2026-06-04: docs/plans/deploy-prod.md written — 13 tasks across A code prep / B provision / C wire+smoke / D docs+close. Discovery: backend cookies already flip samesite=none+secure when NODE_ENV=production (no fix needed), CORS already env-driven. Seed already idempotent via upsert. Smallest possible diff for actual deploy.

## Blockers
none

## Phase Completion
- [x] Phase 1 GStack — goal.md + progress.md written
- [x] Phase 2 GSD — docs/plans/deploy-prod.md written and 13 tasks listed
- [ ] Phase 3 Superpowers — all tasks checked off, suite passing
- [ ] Phase 4 Ralph Wiggum — [DONE] output received
