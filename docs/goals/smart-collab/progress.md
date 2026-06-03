# Progress — smart-collab (human narrative)

Parent narrative for the whole assessment. Subgoals carry their own progress.md.

## Session log
- 2026-06-03: Phase 1 GStack kicked off. Parent charter (`goal.md`) drafted from EAP 4.0 assessment brief. Subgoal `foundation` scaffolded. Stack decided: Express+Prisma+Postgres backend (mirrors solvemeet_backend_api module pattern), Next.js+TS+Tailwind+shadcn frontend, raw JWT+bcrypt auth (NO better-auth). Monorepo. Vercel + Railway/Render split deploy. Per-section subgoals planned (9 total).

## Decisions
- 2026-06-03: **Raw auth, not better-auth.** User wants to showcase backend depth — hand-rolled bcrypt + JWT + RBAC middleware. Locks foundation subgoal scope.
- 2026-06-03: **Monorepo over split repos.** One GitHub link for assessment submission; backend + frontend live side-by-side under `/`.
- 2026-06-03: **Per-section subgoals.** Each assessment section becomes its own GoalBuddy subgoal under `subgoals/`. Parent task done only when child board reaches `phase: DONE`. Lets us ship + review section by section.
- 2026-06-03: **Backend module pattern locked** to mirror `solvemeet_backend_api/src/app/modules/<feature>/` — five files per feature (constant/controller/routes/service/validation). Sets consistency for every subgoal.

## Blockers (human notes)
None.
