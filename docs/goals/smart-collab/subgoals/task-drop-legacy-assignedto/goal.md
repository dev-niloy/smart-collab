# Goal — task-drop-legacy-assignedto (subgoal)

Parent: `smart-collab`
Branch: `feature/task-drop-legacy-assignedto` off `develop@9566021`
Mode: brownfield · feature · new session

---

## What
Finish the multi-assignee cutover: drop the legacy `Task.assignedTo` column + `Task.assignee` relation, remove all dual-write paths added during `task-multi-assignee` (#B6), hard-reject `assignedTo`/`assigneeIds` on `PATCH /tasks/:id` (t11 promise from #B6), and migrate ~20 backend test fixtures from `prisma.task.create({ assignedTo: x })` to the `TaskAssignee` join shape. Frontend `Task` type loses `assignedTo`/`assignee`; `assignees` becomes required (no more optional during-transition shape). Migration: `ALTER TABLE tasks DROP COLUMN "assignedTo"`.

## Why
`task-multi-assignee` shipped end-to-end multi-assignee but deferred the column drop + strict PATCH rejection to keep the PR small and the suite green during the cutover. Column now functionally inert (dual-written only). Carrying it costs: (a) dead schema column, (b) two reads per filter (legacy + join), (c) confusing API DTO shape with both `assignedTo` and `assignees`, (d) dual-write footguns for any future Task code. Closes backlog #B7.

## Done looks like
1. `backend/prisma/schema.prisma` Task model has no `assignedTo` field, no `assignee` relation, no `@@index([assignedTo])`. New `assignee` relation NAME `TaskAssignedTo` removed from User. `assignees TaskAssignee[]` is the sole assignment shape.
2. Migration `<ts>_drop_task_assignedto/migration.sql` drops the column + index. Applied locally. Backfill from #B6 m1 already populated `task_assignees`; no further data work needed.
3. `task.create` validator + service: removes `assignedTo` field entirely; accepts only `assigneeIds: string[]` (0..N). Service has no `legacyAssignedTo` variable, no dual-write to `Task.assignedTo`, no `assignedTo` data write.
4. `task.update` validator: rejects `assignedTo` AND `assigneeIds` in body with 422 `USE_ASSIGNEE_ENDPOINTS`. Service has no `input.assignedTo` branch, no `syncLegacyAssignedTo` call from update.
5. `syncLegacyAssignedTo` helper deleted. All call sites removed.
6. List filter `buildAssignedToWhere`: filter uses only `taskAssignees` (no `OR` with legacy column). `assignedTo=me` → `taskAssignees.some({userId: me})`; `UNASSIGNED` → `taskAssignees.none({})`; uuid → `taskAssignees.some({userId})`.
7. `canWriteTask` predicate: drops the `task.assignedTo` fallback; only `task.assignees[].userId` matters (plus PM/admin override). `requireTaskOwnerOrPrivileged` middleware: same.
8. Dashboard `getKpis` myOpenTasks / myCompletedTasks: removes `OR` with `assignedTo`; reads only `taskAssignees.some`.
9. `projectMember.buildWorkloadMap`: removes legacy `OR` clause + de-dupe set; counts directly from `taskAssignee` rows. `removeMember` keeps the `taskAssignee.deleteMany` cleanup.
10. `comment.service`: notification recipient set drops legacy `task.assignedTo` merge; reads only `task.assignees[].userId` + `task.createdBy`.
11. Frontend `Task` type (`lib/schemas/task.ts`): `assignedTo` + `assignee` fields removed; `assignees: TaskAssigneeRel[]` non-optional. `createTaskSchema` drops `assignedTo`.
12. Frontend usages of `task.assignedTo` / `task.assignee` / `assigneeMap` legacy fallback removed across `tasks/page.tsx`, `tasks/[taskId]/page.tsx`, `tasks/[taskId]/edit/page.tsx`, `inbox`, `CommandPalette`, `dark-mode-audit` test fixtures, etc.
13. `canWriteFor` on task list page reads only `t.assignees`.
14. ~20 backend test files migrated: any `prisma.task.create({ ... assignedTo: x })` rewritten as `prisma.task.create({ ... assignees: { create: { userId: x, addedById: <creator|actor> } } })`. Any direct `assignedTo: x` in test fixtures objects similarly rewritten.
15. Existing 604 backend tests survive; 457 frontend tests survive. Counts may drop slightly only because of redundant dual-write tests removed.
16. Manual smoke (seeded DB): PM creates task w/ 2 assignees, both flip status, non-assignee 403s, PM adds 3rd, removes one, deletes, restores. Same flow as `task-multi-assignee` smoke, now without legacy column in play.
17. Activity log on PATCH `/tasks/:id` with `assignedTo` or `assigneeIds` returns 422 `USE_ASSIGNEE_ENDPOINTS` (regression-locked by test).

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Locked decisions
- **Single migration approach.** One migration: drop column + drop index. No staged rollout — backfill from `task-multi-assignee` m1 is months-old in repo terms but data shape is already consistent (every legacy `assignedTo` has a matching `TaskAssignee` row).
- **Hard-reject PATCH body keys.** Both `assignedTo` and `assigneeIds` on PATCH → 422. Same code: `USE_ASSIGNEE_ENDPOINTS`. Message: "Use POST/PUT/DELETE /tasks/:id/assignees to change assignees."
- **Frontend `Task.assignees` non-optional.** Bumps from `assignees?: TaskAssigneeRel[]` to `assignees: TaskAssigneeRel[]`. Test fixtures updated; any cached response from before this PR will produce a runtime undefined-access — acceptable: this is a single deployable unit, FE + BE ship together.
- **Test migration shape.** `assignedTo: <uuid>` → `assignees: { create: { userId: <uuid>, addedById: <createdBy or actorId> } }`. Where the test only cares about read-side `assignedTo === userId`, change assertion to `assignees.some(a => a.userId === userId)` or `assignees[0].userId === userId`.
- **No DTO field aliasing.** Don't keep `assignedTo` as a computed getter for back-compat. Hard removal.
- **Seed.** Already creates TaskAssignee rows in addition to legacy `assignedTo`. Drop the legacy `assignedTo` writes from seed too.

## Constraints (brownfield)
- MUST keep all `task-multi-assignee` (#B6) RBAC, soft-delete (#B5), member-visibility (#B1) semantics intact.
- MUST NOT break the 604 / 457 baseline. Net count may drop if redundant dual-write tests get retired, but every preserved test must still pass.
- MUST NOT touch unrelated subgoals' tests (only files referencing `assignedTo` change).
- MUST drop column in a SINGLE migration — no rename-then-drop dance.
- MUST drop the schema relation `assignee User?` from Task and its inverse `tasksAssigned Task[]` from User. Prisma generate must succeed.
- MUST NOT alter `TaskAssignee` table shape (existing PK, indexes, FKs stay).
- MUST keep API endpoint URLs stable (no rename of `/tasks/:id/assignees` routes).
- MUST keep activity log `task.assigned` / `task.unassigned` actions; only the SOURCE of the data changes.
- MUST NOT introduce new dependencies.

## Scope
- IN:
  - Backend: schema diff (drop column + relation), migration SQL, generate.
  - Backend: service + validation hard-reject + dual-write removal across task / dashboard / projectMember / comment.
  - Backend: test file migration (~20 files) to TaskAssignee fixture shape.
  - Backend: `syncLegacyAssignedTo` helper deletion + call site cleanup.
  - Frontend: `Task` type + `createTaskSchema` cleanup.
  - Frontend: usages of `t.assignedTo` / `t.assignee` / `assigneeMap` legacy paths.
  - Tests: new test pinning PATCH 422 `USE_ASSIGNEE_ENDPOINTS`.
  - Seed: drop legacy `assignedTo` writes (rely on TaskAssignee only).
- OUT:
  - Any new feature work (single-assignee compatibility shim, audit log additions, notification format changes).
  - `TaskAssignee` shape changes (e.g. `isPrimary` for primary-assignee — captured separately in deferred backlog from #B6).
  - Inbox / dashboard new filters.
- DEFERRED:
  - Cleanup of `requireTaskOwnerOrPrivileged` middleware if still unused after this PR (was already dead code; not in scope to remove).

## Existing Tests
- Backend: Jest — 604 baseline. Target after migration: ≥595 (allow ≤9-test drop only from explicitly-retired dual-write coverage; ideally stays at 604+ with new PATCH-reject test bringing it to 605).
- Frontend: Vitest — 457 baseline. Target: ≥455.
- Coverage command (backend): `cd backend && npm test --silent`
- Coverage command (frontend): `cd frontend && npm test -- --run`
- Baseline passing: verified at t1.

## Acceptance Criteria
Items 1–17 above. Verified by: backend Jest suite, frontend Vitest suite, typecheck both, Prisma generate succeeds, manual seed-based smoke (same scenarios as #B6 close).
