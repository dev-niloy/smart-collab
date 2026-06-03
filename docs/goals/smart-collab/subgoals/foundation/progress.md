# Progress — foundation (human narrative)

Thin log. Board (`state.yaml`) holds task status + receipts. This file holds the story.

## Session log
- 2026-06-03: Phase 3 Superpowers — entering TDD loop at t1. Git initialized at root (main protected). Branches: develop off main, feature/foundation off develop. Removed orphan docs/goals/foundation-exec/ (v2 schema from prior session, conflicted with WORKFLOW.md hybrid).
- 2026-06-03: Phase 2 GSD — board sliced into 26 tasks (t1-t26) across 6 phases: monorepo+infra, backend core, prisma, auth module, frontend foundation, deploy plumbing. Each task ~2-5 min, ends with commit. Awaiting user OK before Phase 3.
- 2026-06-03: Phase 1 GStack locked by user. Moving to Phase 2 GSD.
- 2026-06-03: Phase 1 GStack — `goal.md` drafted. Scope: monorepo scaffold + raw-auth backend module + RBAC + Prisma schema (User/Session/ActivityLog placeholder) + Next.js+shadcn shell with Login/Signup/Dashboard/Demo Login + CI + deploy plumbing (no public push yet). Awaiting user lock before Phase 2 slicing.

## Decisions
- 2026-06-03: **Both tokens as httpOnly cookies** (access + refresh). SameSite=Lax dev, None+Secure prod. Easiest demo, Next.js middleware reads cookie directly for guards. Tradeoff accepted: CORS needs `credentials:true` + exact origin allowlist.
- 2026-06-03: **Dev Postgres via docker-compose** at repo root. One `docker compose up -d postgres` away from working. Matches solvemeet_backend_api pattern.
- 2026-06-03: **Fine slicing** (~25 tasks, 2-5 min each) over coarse. Maximizes Phase 3 receipt granularity — every task has a verifiable proof. Tradeoff accepted: longer board, more commits.
- 2026-06-03: **`User` model schema locked here.** Later subgoals add new tables/columns but cannot alter existing User columns. Prevents migration churn.
- 2026-06-03: **Refresh tokens stored hashed** in a `Session` row, never plaintext. Showcases real backend hygiene.
- 2026-06-03: **shadcn + next-themes provider land in foundation** even though dark-mode polish is §10. Avoids a frontend retrofit later.
- 2026-06-03: **Deploy plumbing yes, deploy push no.** Dockerfile + vercel.ts stub + GH Actions land here; actual public URLs in `deploy-and-readme` subgoal.

## Blockers (human notes)
None yet. Phase 2 will need to decide: access token in httpOnly cookie OR `Authorization` header. Both viable; cookie = simpler XSS story + Next.js middleware can read it; header = simpler CORS + cleaner mobile path. Will surface as a Phase 2 question.
