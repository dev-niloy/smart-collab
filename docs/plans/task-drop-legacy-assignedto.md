# Plan — task-drop-legacy-assignedto (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/task-drop-legacy-assignedto/goal.md`
Branch: `feature/task-drop-legacy-assignedto` off `develop@9566021`
Mode: brownfield · feature · new session

Each task ends with a commit. RED → GREEN → REFACTOR → suite green → commit.

**Real blast radius (grepped 2026-06-06):**
- Backend src + prisma w/ `assignedTo` refs: 25 files
- Backend test fixture files: 15 (listed in goal.md)
- Frontend files w/ legacy refs (`assignedTo` / `.assignee.X`): 15
- Backend uses `task.assignee.X` relation accessor: **0** (clean)
- Frontend uses `task.assignee.X`: 2 files (`HighPriorityList.tsx`, `edit/page.tsx`)

**Order (advisor-locked):** tests first, regression guard second, dual-write removal third, FE flip fourth, column drop last. Each commit keeps the suite green.

---

## Phase A — baseline + regression guard (FIRST)

### Task 1: baseline verification commit
Files: none
Steps:
- 1. `cd backend && npm test --silent` → expect 604 passing
- 2. `cd frontend && npm test -- --run` → expect 457 passing
- 3. Empty commit `chore: baseline before task-drop-legacy-assignedto work begins`
Status: [ ]

### Task 2: backend test fixtures — migrate `assignedTo: x` → TaskAssignee
Files (15 test files in goal.md "BE files w/ assignedTo:"):
- `backend/src/app/modules/dashboard/__tests__/dashboard.service.kpis.test.ts`
- `backend/src/app/modules/dashboard/__tests__/dashboard.routes.test.ts`
- `backend/src/app/modules/dashboard/__tests__/dashboard.service.lists.test.ts`
- `backend/src/app/modules/projectMember/__tests__/projectMember.service.remove.test.ts`
- `backend/src/app/modules/task/__tests__/task.service.list.test.ts`
- `backend/src/app/modules/projectMember/__tests__/projectMember.service.list.test.ts`
- `backend/src/app/modules/notification/__tests__/notification.triggers.test.ts`
- `backend/src/app/modules/projectMember/__tests__/projectMember.routes.test.ts`
- `backend/src/app/modules/task/__tests__/task.service.activity.diff.test.ts`
- `backend/src/app/modules/task/__tests__/task.service.update.rbac.test.ts`
- `backend/src/app/modules/task/__tests__/task.service.permissions.test.ts` (only if it has fixtures)
- `backend/src/app/modules/task/__tests__/task.validation.test.ts`
- `backend/src/app/modules/task/__tests__/task.routes.test.ts`
- `backend/src/app/modules/task/__tests__/task.service.activity.test.ts`
- `backend/src/app/modules/task/__tests__/task.service.crud.test.ts`
Steps:
- 1. For each `prisma.task.create({ ... assignedTo: x ... })`, rewrite to:
     `prisma.task.create({ ... assignees: { create: { userId: x, addedById: <creator|actor> } } })`. Set `assignedTo: null` if column still required by schema at this t (it is — drop happens in t6).
- 2. For `prisma.task.createMany([{ assignedTo: x, ... }, ...])`, switch each to a loop of `prisma.task.create` (createMany has no nested-write support).
- 3. For taskService.create calls in tests that passed `{ assignedTo: x }`, switch to `{ assigneeIds: [x] }`.
- 4. For routes tests sending `{ assignedTo: x }` in POST body, switch to `{ assigneeIds: [x] }`.
- 5. Assertions: `task.assignedTo === userId` → `task.assignees.some(a => a.userId === userId)` (or `[0].userId === userId`). Drop `expect(task.assignedTo).toBe(...)` style.
- 6. Run full suite → expect 604 still passing (service still dual-writes, both shapes work).
- 7. Commit `test: migrate backend fixtures to TaskAssignee shape`
Status: [ ]

### Task 3: PATCH hard-reject `assignedTo` + `assigneeIds` body keys
Files:
- `backend/src/app/modules/task/task.validation.ts`
- `backend/src/app/modules/task/__tests__/task.service.update.rbac.test.ts`
- `backend/src/app/modules/task/__tests__/task.routes.test.ts`
Steps:
- 1. RED: PATCH `/api/v1/tasks/:id` w/ `{ assignedTo: x }` → 422 `USE_ASSIGNEE_ENDPOINTS`. Same for `{ assigneeIds: [x] }`.
- 2. GREEN: `updateTaskSchema` zod refine — fail when `assignedTo` or `assigneeIds` keys present. Error code: `USE_ASSIGNEE_ENDPOINTS`. Message: "Use POST/PUT/DELETE /tasks/:id/assignees to change assignees."
- 3. Drop the `assignedTo` field from `updateTaskSchema` itself so it never reaches the service.
- 4. Update any test that PATCHes `assignedTo` to instead call new endpoints OR expect 422 (where the legacy reassign-via-PATCH test was the point). The activity-diff "reassign via PATCH" test → either drop or rewrite via PUT.
- 5. Full suite → expect 605+ (new regression test added; activity-diff test may convert or drop).
- 6. Commit `feat(tasks): PATCH /tasks/:id rejects assignedTo + assigneeIds keys (422 USE_ASSIGNEE_ENDPOINTS)`
Status: [ ]

---

## Phase B — service dual-write removal (regression guarded)

### Task 4: service layer single-source-of-truth — `task.create` + `task.update`
Files:
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/task.validation.ts` (drop `assignedTo` field from `createTaskSchema`)
Steps:
- 1. `createTaskSchema`: drop `assignedTo` field entirely. Keep `assigneeIds`.
- 2. `task.service` create:
   - Delete `normalizeCreateAssignees` legacy fallback that mapped `input.assignedTo → [assignedTo]`.
   - Delete `legacyAssignedTo` variable and the `assignedTo: legacyAssignedTo` line in `tx.task.create.data`.
   - Keep `assignees: { create: ... }`.
- 3. `task.service` update:
   - Delete the dual-write block (`if (input.assignedTo !== undefined && input.assignedTo !== current.assignedTo) { … taskAssignee.deleteMany/create … }`).
   - Delete `assignedTo` from the `tx.task.update.data` spread.
   - Delete the entire "if (input.assignedTo !== undefined ...) { recordActivity(task.assigned) + enqueueNotification }" block (reassignment via endpoints now owns the activity + notify path).
   - Delete `current.assignedTo` from select.
- 4. Run suite → expect green (tests now use assigneeIds + endpoints).
- 5. Commit `feat(tasks): create + update use TaskAssignee as sole assignee source`
Status: [ ]

### Task 5: list filter + cross-module dual-read removal
Files:
- `backend/src/app/modules/task/task.service.ts` (`buildAssignedToWhere`, `canWriteTask`)
- `backend/src/app/modules/task/task.ownership.ts` (`requireTaskOwnerOrPrivileged` middleware)
- `backend/src/app/modules/dashboard/dashboard.service.ts` (myOpenTasks / myCompletedTasks)
- `backend/src/app/modules/projectMember/projectMember.service.ts` (`buildWorkloadMap`)
- `backend/src/app/modules/comment/comment.service.ts` (notification recipient set)
Steps:
- 1. `buildAssignedToWhere`: collapse OR/AND to single `taskAssignees.some` / `taskAssignees.none`. Remove `assignedTo` clauses.
- 2. `canWriteTask`: delete the `if (!task.assignees ... fallback to task.assignedTo)` branch.
- 3. `requireTaskOwnerOrPrivileged`: drop `assignedTo` from the select + remove `task.assignedTo === actorId` clause.
- 4. Dashboard `getKpis`: collapse `OR: [{ assignees }, { assignedTo }]` to just `assignees: { some: { userId: scope.actorId } }`.
- 5. ProjectMember `buildWorkloadMap`: drop the legacy-OR query path + de-dupe set; query `prisma.taskAssignee` directly w/ a single groupBy/findMany.
- 6. Comment service `ensureTaskExists`: drop `assignedTo` from select, drop the recipientSet.add(task.assignedTo) line.
- 7. Delete `syncLegacyAssignedTo` helper. Grep `syncLegacyAssignedTo` returns 0 references.
- 8. Run suite → green.
- 9. Commit `feat(modules): drop legacy assignedTo dual-read from filters + dashboard + workload + comment`
Status: [ ]

---

## Phase C — frontend cleanup

### Task 6: frontend Task type + schemas
Files:
- `frontend/src/lib/schemas/task.ts` (drop `assignedTo`, `assignee`; flip `assignees` to required)
- `frontend/src/lib/schemas/__tests__/task.test.ts`
- `frontend/src/lib/__tests__/tasks.test.ts`
- `frontend/src/components/dashboard/HighPriorityList.tsx` (uses `t.assignee.name`)
- `frontend/src/components/dashboard/__tests__/HighPriorityList.test.tsx`
- `frontend/src/components/shell/__tests__/CommandPalette.test.tsx`
- `frontend/src/components/tasks/__tests__/inline-status-select.test.tsx`
- `frontend/src/hooks/__tests__/useTasks.test.tsx`
- `frontend/src/app/(authed)/projects/[id]/tasks/page.tsx` (`canWriteFor`, `assigneeMap` fallback)
- `frontend/src/app/(authed)/projects/[id]/tasks/__tests__/page.test.tsx`
- `frontend/src/app/(authed)/projects/[id]/tasks/[taskId]/page.tsx`
- `frontend/src/app/(authed)/projects/[id]/tasks/[taskId]/__tests__/page.test.tsx`
- `frontend/src/app/(authed)/projects/[id]/tasks/[taskId]/edit/page.tsx` (drop legacy fallback)
- `frontend/src/app/(authed)/projects/[id]/tasks/[taskId]/edit/__tests__/page.test.tsx`
- `frontend/src/app/(authed)/projects/[id]/tasks/new/__tests__/page.test.tsx`
- `frontend/src/app/(authed)/projects/[id]/tasks/new/__tests__/assignee-scoped.test.tsx`
Steps:
- 1. `Task` type: remove `assignedTo: string | null` + `assignee: TaskUser | null`. Flip `assignees?: TaskAssigneeRel[]` → `assignees: TaskAssigneeRel[]`.
- 2. `createTaskSchema`: drop `assignedTo` field.
- 3. Every Task test fixture: add `assignees: []` (or populate). Remove `assignedTo: null, assignee: null, deletedAt: null` if Task type no longer has them.
- 4. `HighPriorityList.tsx`: switch `t.assignee.name` → first assignee name from `t.assignees`.
- 5. `tasks/page.tsx`: `canWriteFor` simplifies to `t.assignees.some(...)`. `assigneeMap` retained ONLY for legacy `assigneeIds → user lookup` (still needed?). Inspect; remove if dead.
- 6. `tasks/[taskId]/page.tsx`: drop the `task.assignedTo === user.id` fallback in `canEdit`.
- 7. `edit/page.tsx`: drop `task.assignee` branch in `readOnlyAssignees` + `assigneeOptions` builder. Drop legacy `initialAssigneeIds` `task.assignedTo` fallback.
- 8. `npm run typecheck` clean.
- 9. `npm test -- --run` green.
- 10. Commit `refactor(frontend): Task type drops assignedTo + assignee; assignees becomes required`
Status: [ ]

---

## Phase D — schema cutover

### Task 7: drop column migration + Prisma schema diff
Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<ts>_drop_task_assignedto/migration.sql` (NEW)
- `backend/prisma/seed.ts` (drop legacy `assignedTo` writes — rely on TaskAssignee only)
Steps:
- 1. Schema: remove `assignedTo String? @db.Uuid` field, remove `assignee User? @relation("TaskAssignedTo", …)` from Task, remove `@@index([assignedTo])`, remove `tasksAssigned Task[] @relation("TaskAssignedTo")` from User.
- 2. Create migration SQL by hand:
     ```
     DROP INDEX IF EXISTS "tasks_assignedTo_idx";
     ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_assignedTo_fkey";
     ALTER TABLE "tasks" DROP COLUMN "assignedTo";
     ```
- 3. `npx prisma migrate deploy` → applied.
- 4. `npx prisma generate` → succeeds.
- 5. Seed: drop `assignedTo: t.assignedTo` from `client.task.upsert` and the project-B task. Keep only `assignees: { create: [...] }` shape.
- 6. `npx tsx prisma/seed.ts` → succeeds; verify `task_assignees` row count matches expected.
- 7. Full backend suite → green.
- 8. Commit `feat(schema): drop Task.assignedTo column + relation`
Status: [ ]

---

## Phase E — close

### Task 8: smoke + close
Files:
- `docs/goals/smart-collab/subgoals/task-drop-legacy-assignedto/progress.md`
- `docs/goals/smart-collab/subgoals/task-drop-legacy-assignedto/state.yaml`
- `docs/goals/smart-collab/notes/backlog.md` (mark #B7 RESOLVED)
Steps:
- 1. Manual smoke: PM creates task w/ 2 assigneeIds, both update status (200), non-assignee 403, PM adds 3rd via POST, removes one via DELETE, replaces full list via PUT, deletes + restores. All with the legacy column GONE.
- 2. Confirm `grep -rln "assignedTo" backend/src/ frontend/src/ | wc -l` returns 0 (or only test names like "test rejects assignedTo").
- 3. Update progress.md + state.yaml: phase=4 (or DONE if no Ralph), all task statuses [x].
- 4. Backlog: mark #B7 RESOLVED.
- 5. Commit `docs(task-drop-legacy-assignedto): close subgoal — all tasks done`
- 6. Push + open PR vs develop.
Status: [ ]

---

## Test count math (transparency per advisor)

Baseline backend: 604.
- t3 adds: +1 PATCH-reject regression test (maybe +2 — one each for `assignedTo` + `assigneeIds`).
- t4 retires: -1 "back-compat (legacy assignedTo)" test in `task.service.crud.test.ts`. -1 "reassign via PATCH" route test (or convert).
- t2/t6 fixture rewrites: net 0 (same coverage, different shape).

Expected landing: 604–606. Goal target: ≥595 (gives 9-test cushion for retire-only drops).

Baseline frontend: 457.
- t6: fixture rewrites are mechanical; potentially -1 if a test was specifically asserting the legacy-fallback codepath.

Expected landing: 456–457. Goal target: ≥455.
