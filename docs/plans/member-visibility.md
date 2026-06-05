# Plan — member-visibility (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/member-visibility/goal.md`
Branch: `feature/member-visibility` off `develop@243b1d7`
Mode: brownfield · feature · new session

Each task ends with a commit. RED → GREEN → REFACTOR → suite green → commit.
Internal steps stay <5 min; tasks bigger than that auto-slice during execution.

---

## Phase A — backend service scoping

### Task 1: baseline verification commit
Files: none
Steps:
- 1. `cd backend && npm test --silent` → expect 528 passing
- 2. `cd frontend && npm test -- --run` → expect 441 passing
- 3. Empty commit `chore: baseline before member-visibility work begins`
Status: [x] 2026-06-05

### Task 2: extend Scope/Actor type — thread role through service signatures
Files:
- `backend/src/app/modules/project/project.service.ts`
- `backend/src/app/modules/task/task.service.ts`
Steps:
- 1. RED: add tiny shape test asserting `list({ actor: { id, role: 'admin' } })` compiles.
- 2. GREEN: add `actor: { id: string; role: Role }` to `ListArgs` for both services. Backward-compat default: missing actor = admin (preserve existing callsites during refactor).
- 3. REFACTOR: `isAdmin(actor)` helper + `memberFilter(actor)` returning `Prisma.ProjectWhereInput | undefined`.
- 4. Commit `refactor(rbac): thread actor + role through project/task service signatures`
Status: [x] 2026-06-05

### Task 3: projectService.list filters by membership for non-admin
Files:
- `backend/src/app/modules/project/project.service.ts`
- `backend/src/app/modules/project/__tests__/project.service.list.test.ts`
Steps:
- 1. RED: seed 2 projects (A creator=pm1, B creator=pm2); list as pm1 → only A; as admin → both; as team_member not in either → empty.
- 2. GREEN: when `!isAdmin(actor)`, add `members: { some: { userId: actor.id } }` to `where`.
- 3. REFACTOR: confirm single SQL w/ EXISTS subquery — no N+1.
- 4. Commit `feat(rbac): project list filters by membership for non-admin actors`
Status: [x] 2026-06-05

### Task 4: projectService.findById returns 403 for non-member
Files:
- `backend/src/app/modules/project/project.service.ts`
- `backend/src/app/modules/project/__tests__/project.service.crud.test.ts`
Steps:
- 1. RED: non-member → ApiError(403, 'FORBIDDEN'); admin + member → return project.
- 2. GREEN: after fetch, if `!isAdmin(actor)` AND no projectMember row → throw `ApiError.forbidden('FORBIDDEN')`.
- 3. REFACTOR: single `findUnique` w/ filtered `_count.members` to avoid extra round trip.
- 4. Commit `feat(rbac): project detail 403 for non-member actors`
Status: [x] 2026-06-05

### Task 5: taskService.list (cross-project) filters by membership
Files:
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/__tests__/task.service.list.test.ts`
Steps:
- 1. RED: 2 projects, 2 tasks each, distinct members; cross-project list as pm1 → only tasks in projects pm1 is in.
- 2. GREEN: add `project: { members: { some: { userId: actor.id } } }` to where when `!isAdmin(actor)`.
- 3. REFACTOR: reuse filter helper from t3.
- 4. Commit `feat(rbac): task list filters by project membership for non-admin`
Status: [x] 2026-06-05

### Task 6: project-scoped task list 403 for non-member
Files:
- `backend/src/app/modules/task/task.service.ts`
- corresponding test
Steps:
- 1. RED: non-member `listForProject(projectId)` → 403; admin + member → succeed.
- 2. GREEN: pre-check via cheap EXISTS / COUNT before the actual list query.
- 3. REFACTOR: extract `assertProjectAccess(actor, projectId)` reused by t4 + t6 + t7.
- 4. Commit `feat(rbac): project-scoped task list 403 for non-member`
Status: [x] 2026-06-05

### Task 7: taskService.findById 403 for non-member of task's project
Files:
- `backend/src/app/modules/task/task.service.ts`
- `findById` test file
Steps:
- 1. RED: non-member → 403; admin + member → 200.
- 2. GREEN: after fetching task, call `assertProjectAccess(actor, task.projectId)`.
- 3. REFACTOR: confirm one extra query OK; if hot, fold into the fetch via filtered include.
- 4. Commit `feat(rbac): task detail 403 for non-member`
Status: [x] 2026-06-05

---

## Phase B — controllers + invariants

### Task 8: thread req.user → service.actor in all touched controllers
Files:
- `backend/src/app/modules/project/project.controller.ts`
- `backend/src/app/modules/task/task.controller.ts`
Steps:
- 1. RED: route tests asserting authenticated non-admin → filtered list — confirm wiring.
- 2. GREEN: pass `{ id: req.user.id, role: req.user.role }` as `actor` to every service call.
- 3. REFACTOR: `getActor(req)` helper to avoid duplication.
- 4. Commit `feat(rbac): controllers thread req.user as actor into services`
Status: [x] 2026-06-05

### Task 9: integration test — creator-auto-pm invariant preserved
Files:
- `backend/src/app/modules/project/__tests__/project.routes.test.ts`
Steps:
- 1. RED: as project_manager, POST a project then GET it → 200.
- 2. GREEN: no service change expected — confirms existing creator-auto-pm logic survives.
- 3. REFACTOR: none.
- 4. Commit `test(rbac): creator can see their freshly-created project (auto-pm invariant)`
Status: [x] 2026-06-05

---

## Phase C — frontend surface adjustments

### Task 10: surface Members tab link to project_manager on detail header
Files:
- `frontend/src/app/(authed)/projects/[id]/page.tsx`
- corresponding test
Steps:
- 1. RED: PM sees "Members (N)" link; team_member sees it too but without "Add member" button.
- 2. GREEN: relax `useRole` gate currently restricting to admin; widen to admin+pm for write actions, keep read for everyone.
- 3. REFACTOR: keep members page route as-is.
- 4. Commit `feat(rbac): surface Members tab to PM + read-only to team_member on project detail`
Status: [x] 2026-06-05

### Task 11: 403 client-side handling on project detail page
Files:
- `frontend/src/app/(authed)/projects/[id]/page.tsx`
- `frontend/src/lib/api.ts` (verify ApiError carries code/status — should already)
- corresponding test
Steps:
- 1. RED: simulate `getProject(id)` rejecting w/ ApiError(403); page renders "You don't have access to this project" + Back link.
- 2. GREEN: branch on `isError && error?.status === 403`.
- 3. REFACTOR: reuse existing /forbidden route if present; else inline panel.
- 4. Commit `feat(rbac): project detail page handles 403 gracefully`
Status: [x] 2026-06-05

---

## Phase D — close

### Task 12: full suite green + 3-role manual smoke
Files: none
Steps:
- 1. `cd backend && npm test --silent` → expect ≥528
- 2. `cd frontend && npm test -- --run` → expect ≥441
- 3. `cd frontend && npm run typecheck` → 0 errors
- 4. `cd frontend && npm run lint` → 0 errors
- 5. Manual smoke:
  - 5a. admin@demo.local → sees ALL projects.
  - 5b. pm@demo.local → sees only projects PM is a member of. Non-member project URL → 403.
  - 5c. member@demo.local → sees only projects they were added to (need add via admin or seed).
  - 5d. Member views project tasks → sees ALL tasks in that project (Mine chip still works).
  - 5e. Member visits non-member project URL → 403 page.
- 6. Commit `test: verify member-visibility suite green + 3-role smoke`
Status: [x] 2026-06-05

### Task 13: docs + close phase 3
Files:
- `docs/goals/smart-collab/subgoals/member-visibility/state.yaml`
- `docs/goals/smart-collab/subgoals/member-visibility/progress.md`
- `docs/goals/smart-collab/notes/backlog.md` (mark #B1 RESOLVED)
Steps:
- 1. Flip `state.yaml` phase: 3, `superpowers: true`, `next_task: t14`.
- 2. Update progress.md.
- 3. Mark #B1 RESOLVED in backlog.
- 4. Commit `docs(member-visibility): phase 3 superpowers complete + #B1 resolved`
Status: [x] 2026-06-05

### Task 14: USER PERMISSION — push + open PR feature/member-visibility → develop
Files: none
Steps:
- 1. (USER PERMISSION) `git push -u origin feature/member-visibility`
- 2. (USER PERMISSION) `gh pr create --base develop --title "feat(rbac): scope project + task visibility by ProjectMember (closes #B1)"`
Status: [ ]

---

## Notes on scope discipline
- One concern per task. >2 files = slice.
- Brownfield: every task preserves goal.md Constraints (no schema change, no API shape change, creator-auto-pm preserved).
- Defer anything that creeps in (e.g. seed-script for member@demo.local → record as open follow-up).

## Goal-backward verification

| Done # | Criterion | Covered by |
|---|---|---|
| 1 | project list filtered by membership | t3 |
| 2 | project detail 403 for non-member | t4 |
| 3 | project-scoped task list 403 | t6 |
| 4 | cross-project task list filtered | t5 |
| 5 | task detail 403 for non-member | t7 |
| 6 | creator-auto-pm invariant preserved | t9 |
| 7 | admin-flow tests untouched | t3-t7 (admin branch in each) |
| 8 | Members tab surfaced for PM + read-only for member | t10 |
| 9 | 3-role smoke passes | t12 |
