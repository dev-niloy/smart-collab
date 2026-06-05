# Plan — progress-system (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/progress-system/goal.md`
Branch: `feature/progress-system` off `develop@25fb539`
Mode: brownfield · feature · new session

Each task ends with a commit. RED → GREEN → REFACTOR → suite green → commit.
Internal steps stay <5 min; tasks bigger than that auto-slice during execution.

---

## Phase A — backend aggregate

### Task 1: baseline verification commit
Files: none
Steps:
- 1. `cd backend && npm test --silent` → expect 523 passing
- 2. `cd frontend && npm test -- --run` → expect 427 passing
- 3. Empty commit `chore: baseline before progress-system work begins`
Status: [x] 2026-06-05

### Task 2: project service aggregates progress on list + detail
Files:
- `backend/src/projects/service.ts` (EXISTING)
- `backend/src/projects/__tests__/service.test.ts` (EXISTING)
Steps:
- 1. RED: add tests asserting `listProjects` + `getProject` return `progress: {done, total, percent}` w/ correct math (empty=0%, all-done=100%, partial=round). Seed mixed-status tasks per fixture.
- 2. GREEN: extend Prisma queries — single SQL aggregate via `_count` w/ `where: {status: 'done'}` OR raw `groupBy` join. No N+1.
- 3. REFACTOR: extract `computeProgress(done, total)` pure helper. Confirm round-half-even (or floor) behavior matches tests.
- 4. Commit `feat(projects): aggregate task progress {done,total,percent} on list + detail`
Status: [x] 2026-06-05

### Task 3: Zod schema + DTO type update
Files:
- `backend/src/projects/validation.ts` (EXISTING)
- `backend/src/projects/types.ts` or shared DTO file (EXISTING)
- `frontend/src/lib/schemas/project.ts` (EXISTING)
Steps:
- 1. RED: schema test rejects negative `done`, requires `percent ∈ [0,100]`, requires `done ≤ total`.
- 2. GREEN: extend `projectResponseSchema` (backend) + `Project` Zod schema (frontend) w/ `progress` object.
- 3. REFACTOR: re-export `ProjectProgress` type from one place.
- 4. Commit `feat(projects): Project DTO includes progress field`
Status: [x] 2026-06-05

---

## Phase B — frontend primitives

### Task 4: ProgressBar primitive
Files:
- `frontend/src/components/ui/progress.tsx` (NEW — shadcn `progress`)
- `frontend/src/components/ui/__tests__/progress.test.tsx` (NEW)
Steps:
- 1. `npx shadcn@latest add progress --yes`
- 2. RED: test renders w/ correct ARIA (`role="progressbar"`, `aria-valuenow`, `aria-valuemin=0`, `aria-valuemax=100`), correct width style.
- 3. GREEN: confirm shadcn output passes; add minimal wrapper if needed for project-specific sizing variants.
- 4. Commit `feat(ui): add Progress primitive`
Status: [x] 2026-06-05

### Task 5: ProjectProgress helper component
Files:
- `frontend/src/components/projects/ProjectProgress.tsx` (NEW)
- `frontend/src/components/projects/__tests__/ProjectProgress.test.tsx` (NEW)
Steps:
- 1. RED: tests cover 3 variants (`card`, `detail`, `inline`) — `inline` is 2px bar w/ no label, `card` shows "{done}/{total} · {percent}%", `detail` shows large bar + "{done} of {total} tasks · {percent}%". Empty (total=0) renders "0 tasks" + flat bar in card/detail, returns null in inline.
- 2. GREEN: implement variants using ProgressBar primitive.
- 3. REFACTOR: extract label formatter pure helper.
- 4. Commit `feat(projects): ProjectProgress component w/ card/detail/inline variants`
Status: [x] 2026-06-05

---

## Phase C — surface wiring

### Task 6: list card surface
Files:
- `frontend/src/app/(authed)/projects/page.tsx` (EXISTING)
- `frontend/src/app/(authed)/projects/__tests__/page.test.tsx` (EXISTING)
Steps:
- 1. RED: page test asserts `ProjectProgress` renders for each project card w/ `variant="card"` and value driven by `project.progress`.
- 2. GREEN: import + render under the project name/status row.
- 3. REFACTOR: keep card spacing tight; no layout regression.
- 4. Commit `feat(projects): show progress bar on list cards`
Status: [x] 2026-06-05

### Task 7: detail header surface
Files:
- `frontend/src/app/(authed)/projects/[id]/page.tsx` (EXISTING)
- `frontend/src/app/(authed)/projects/[id]/__tests__/page.test.tsx` (EXISTING)
Steps:
- 1. RED: detail test asserts large `ProjectProgress variant="detail"` renders above the deadline/status grid.
- 2. GREEN: add component above the metadata grid.
- 3. REFACTOR: confirm dark-mode tokens, no hex.
- 4. Commit `feat(projects): show progress bar on detail header`
Status: [x] 2026-06-05

### Task 8: sidebar Pinned row inline bar
Files:
- `frontend/src/components/shell/ProjectsPanel.tsx` (EXISTING)
- `frontend/src/components/shell/__tests__/ProjectsPanel.test.tsx` (EXISTING)
Steps:
- 1. RED: tests assert `ProjectRow` renders 2px inline progress under name when `pinned=true` AND `project.progress.total > 0`; nothing rendered when total=0.
- 2. GREEN: render `<ProjectProgress variant="inline" project={p} />` in pinned section only.
- 3. REFACTOR: don't break the existing pin-toggle button hit area; verify hover affordance still works.
- 4. Commit `feat(shell): inline progress bar under pinned project rows`
Status: [x] 2026-06-05

### Task 9: Dashboard "My open tasks" widget aggregate
Files:
- `frontend/src/components/dashboard/MyOpenTasks.tsx` or DashboardGrid (EXISTING — locate during execution)
- corresponding test (EXISTING)
Steps:
- 1. Pre-flight: confirm widget exists; if no widget, scope-out to FOLLOW-UP and skip.
- 2. RED: test asserts aggregate `% done` rendered as a small `ProjectProgress`-style bar across user's assigned tasks (sum of done / sum of total).
- 3. GREEN: compute on client from existing `useTasks({assignedTo:'me'})` query result (already loaded by widget) — no new endpoint.
- 4. REFACTOR: pure aggregate helper `aggregateProgress(tasks)`.
- 5. Commit `feat(dashboard): aggregate progress bar in My Open Tasks widget`
Status: [x] 2026-06-05

---

## Phase D — live invalidation

### Task 10: task mutation invalidates project queries
Files:
- `frontend/src/hooks/useTasks.ts` (EXISTING — useUpdateTask/useCreateTask/useDeleteTask)
- `frontend/src/hooks/__tests__/useTasks.test.ts` if it exists; else assertion via integration test in tasks page
Steps:
- 1. RED: integration test mutates a task status, then asserts `['projects']` + `['project', projectId]` keys are invalidated (queryClient spy).
- 2. GREEN: extend mutation `onSettled` to invalidate both keys.
- 3. REFACTOR: confirm no over-invalidation (e.g. don't invalidate sibling projects).
- 4. Commit `feat(tasks): invalidate project queries on task mutation so progress refreshes`
Status: [x] 2026-06-05

---

## Phase E — close

### Task 11: full suite green + local manual smoke
Files: none
Steps:
- 1. `cd backend && npm test --silent` → expect ≥523 passing
- 2. `cd frontend && npm test -- --run` → expect ≥427 passing
- 3. `cd frontend && npm run typecheck` → 0 errors
- 4. `cd frontend && npm run lint` → 0 errors (warnings OK)
- 5. Manual smoke (browser):
  - 5a. Create project → list shows 0/0 · 0%
  - 5b. Add 3 tasks (todo / in_progress / done) → list + detail show 1/3 · 33%
  - 5c. Pin project → sidebar Pinned shows 2px bar at ~33% width
  - 5d. Mark in_progress → done → all surfaces flip to 2/3 · 67% WITHOUT page refresh
  - 5e. Dashboard "My Open Tasks" widget reflects aggregate
- 6. Commit `test: verify progress-system suite green + manual smoke`
Status: [x] 2026-06-05

### Task 12: docs + screenshot + close phase 3
Files:
- `README.md` (one-line mention near Stack section if relevant)
- `docs/goals/smart-collab/subgoals/progress-system/state.yaml`
- `docs/goals/smart-collab/subgoals/progress-system/progress.md`
Steps:
- 1. Optional: screenshot of detail header w/ bar → `frontend/public/screens/progress.png`.
- 2. Flip `state.yaml` phase: 3, mark `superpowers: true`, `next_task: t13`.
- 3. Update progress.md.
- 4. Commit `docs(progress-system): phase 3 superpowers complete`
Status: [x] 2026-06-05

### Task 13: USER PERMISSION — push + open PR feature/progress-system → develop
Files: none
Steps:
- 1. (USER PERMISSION) `git push -u origin feature/progress-system`
- 2. (USER PERMISSION) `gh pr create --base develop --title "feat(projects): task-completion progress on cards, detail, sidebar, dashboard"`
Status: [x] 2026-06-05 — pushed; PR #28 https://github.com/dev-niloy/smart-collab/pull/28

---

## Notes on scope discipline
- One concern per task. >2 files = slice into follow-up tasks.
- Brownfield: every task must preserve goal.md Constraints (no DB schema change, no N+1, additive DTO).
- Defer anything that creeps in mid-execution; record in `state.yaml.blockers` or open a follow-up subgoal.

## Goal-backward verification

| Done # | Criterion | Covered by |
|---|---|---|
| 1 | List endpoint returns progress | t2, t3 |
| 2 | Detail endpoint returns progress | t2, t3 |
| 3 | List card renders bar w/ label | t6 |
| 4 | Detail header renders bar | t7 |
| 5 | Sidebar Pinned rows render inline bar | t8 |
| 6 | Dashboard widget aggregates | t9 |
| 7 | Task mutation re-renders progress live | t10 |
