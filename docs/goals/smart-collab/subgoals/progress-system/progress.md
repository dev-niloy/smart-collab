# Progress — progress-system

## Project
- Subgoal: progress-system
- Started: 2026-06-05
- Last updated: 2026-06-05

## Current Phase
Phase 3 Superpowers — DONE (t1–t12). t13 (push + PR) gated on user permission.

## Locked decisions
- Weighting: binary (industry standard — Linear/Jira/Asana default)
- Surfaces: list card + detail header + sidebar Pinned + Dashboard widget
- Compute: server-side aggregate folded into existing project list + detail endpoints
- Primitive: shadcn `progress` + `ProjectProgress` helper with card/detail/inline variants
- Caching: react-query invalidation on task mutations (no DB-side cache layer)

## Last Completed Task
t13 — branch pushed; PR #28 open https://github.com/dev-niloy/smart-collab/pull/28

## Next Task
none — awaiting Phase 4 Ralph Wiggum or merge approval

## Session Log
- 2026-06-05: phase 1 — user brainstorm answered (binary weighting, 4 surfaces, server-side compute). goal.md drafted w/ 7 done-criteria + 6 brownfield constraints. User approved.
- 2026-06-05: phase 2 — docs/plans/progress-system.md written, 13 tasks. state.yaml synced. Branch off develop@25fb539.
- 2026-06-05: t1 — baseline confirmed: backend 523, frontend 427. Empty commit 831d69b.
- 2026-06-05: t2 — projectService.list + findById aggregate progress {done,total,percent} via single batched task.groupBy on projectIds (no N+1). `computeProgress(done, total)` pure helper handles 0/0=0, rounds to int. 5 new service tests (empty / all-done / partial 1/3=33% / all-todo / list batch). Backend 528. Commit fbf487b.
- 2026-06-05: t3 — frontend Project DTO + Zod schema augmented w/ `progress: {done,total,percent}`. ProjectsPanel + CommandPalette test fixtures updated. Commit 25bca82.
- 2026-06-05: t4 — shadcn `progress` primitive installed (`@base-ui/react/progress`). Commit 65e69ce.
- 2026-06-05: t5 — `ProjectProgress` component w/ card/detail/inline variants. `formatProgressLabel` ("1/3 · 33%") + `formatProgressLabelLong` ("1 of 3 tasks · 33%") + "0 tasks" empty case. inline returns null on total=0. 8 tests. Commit bed6e35.
- 2026-06-05: t6 — list page card surface: `<ProjectProgress variant="card" />` under each card. Test fixture progress field + assertion. Frontend +1. Commit ced26e4.
- 2026-06-05: t7 — detail page header surface: `<ProjectProgress variant="detail" />` above metadata grid. Test fixture + assertion (2 of 5 tasks · 40%). Frontend +1. Commit aa1b7fe.
- 2026-06-05: t8 — sidebar Pinned inline bar. Row now flex-column when pinned w/ inline ProjectProgress under name; null when total=0. Pin-toggle button hit area preserved. 2 new tests (pinned + non-pinned bar gating). Commit 499982e.
- 2026-06-05: t9 — Dashboard "My open tasks" widget aggregate. Backend Kpis extended w/ `myCompletedTasks` + `myCompletionPct`. KpiCard accepts `progressPercent` → renders Progress bar under value. DashboardGrid passes myCompletionPct. Frontend Kpis schema + dashboard page test updated. Backend 528 (no test count change — extended existing). Frontend 440. Commit 3673309.
- 2026-06-05: t10 — useCreateTask / useUpdateTask / useDeleteTask now invalidate `['projects']` + `['project', projectId]` + `['dashboard']` on mutation success (plus existing `['tasks']`). Drives live progress refresh across all 4 surfaces. 1 new test asserting invalidation keys. Frontend 441. Commit 14a6949.
- 2026-06-05: rebased onto develop@95a8b64 after chore/rail-tooltips (#27) + earlier fix/task-card-clickable (#26) merged. Clean — no conflicts.
- 2026-06-05: t11 — full suites green (backend 528, frontend 441), typecheck 0 errors, lint 0 errors (5 pre-existing watch warnings). Manual smoke 1-4 PASS as PM/admin. #5 KPI bar verified with 0% (no tasks assigned to current user). Backlog captured: #B1 member visibility scoping (SECURITY) and #B2 dashboard panel cosmetic. Empty commit 80f1223.
- 2026-06-05: t12 — state.yaml phase→3, superpowers:true, next_task→t13. Plan tasks t1–t12 checked off, t13 still pending push permission.

## Blockers
none. (Pre-existing #B1 captured to backlog — not a progress-system blocker.)

## Phase Completion
- [x] Phase 1 GStack — goal.md written and user-approved 2026-06-05
- [x] Phase 2 GSD — docs/plans/progress-system.md w/ 13 tasks
- [x] Phase 3 Superpowers — TDD execution complete (t1–t12); t13 push gated on user
- [ ] Phase 4 Ralph Wiggum — multi-persona review
