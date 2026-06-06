# Plan — task-multi-assignee (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/task-multi-assignee/goal.md`
Branch: `feature/task-multi-assignee` off `develop@bd9d622`
Mode: brownfield · feature · new session

Each task ends with a commit. RED → GREEN → REFACTOR → suite green → commit.
Internal steps stay <5 min; tasks bigger than that auto-slice during execution.

**Migration strategy (locked):** split into two migrations to keep baseline runnable through service rewrite.
- Migration 1 (Phase A t2): add `TaskAssignee` table + backfill from `Task.assignedTo`. Legacy column stays.
- Migration 2 (Phase F t21): drop `Task.assignedTo` column + `assignee` relation after all reads/writes flipped + tests green.

Between m1 and m2 service dual-writes: legacy `assignedTo` + new `TaskAssignee` rows. Reads start from TaskAssignee. Keeps suite green at every commit.

---

## Phase A — schema + backfill (additive)

### Task 1: baseline verification commit
Files: none
Steps:
- 1. `cd backend && npm test --silent` → expect 580 passing
- 2. `cd frontend && npm test -- --run` → expect 442 passing
- 3. Empty commit `chore: baseline before task-multi-assignee work begins`
Status: [x] 2026-06-06

### Task 2: add `TaskAssignee` table + backfill migration
Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<timestamp>_add_task_assignee/migration.sql` (NEW, hand-edited)
Steps:
- 1. Add `TaskAssignee` model — `taskId`, `userId`, `addedById`, `addedAt`; unique `(taskId, userId)`; relations w/ cascade on Task delete; indexes `(taskId)` + `(userId)`. Keep `Task.assignedTo` + `assignee` relation untouched.
- 2. `npx prisma migrate dev --name add_task_assignee --create-only` then hand-edit SQL to append: `INSERT INTO task_assignees (task_id, user_id, added_by_id, added_at) SELECT id, assigned_to, created_by, created_at FROM tasks WHERE assigned_to IS NOT NULL;`
- 3. `npx prisma migrate dev` to apply. Verify on local DB.
- 4. Run backend + frontend suites → 580/442 still passing.
- 5. Commit `feat(schema): add TaskAssignee join table + backfill from assignedTo`
Status: [x] 2026-06-06

---

## Phase B — service layer reads + dual-writes

### Task 3: helper — `getTaskAssignees(taskId)` + include
Files: `backend/src/app/modules/task/task.service.ts`
Steps:
- 1. RED: shape test — task w/ 2 TaskAssignee rows → helper returns `TaskUser[]` ordered by `addedAt`.
- 2. GREEN: include `taskAssignees: { include: { user: true }, orderBy: { addedAt: 'asc' } }` in default select. Map to `assignees: TaskUser[]`.
- 3. REFACTOR: factor `mapTaskAssignees(rows): TaskUser[]`.
- 4. Commit `feat(tasks): assignees included in task select w/ helper`
Status: [x] 2026-06-06 (combined w/ t4)

### Task 4: `canWriteTask` predicate rewritten over `assignees`
Files:
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/task.ownership.ts`
- `backend/src/app/modules/task/__tests__/task.service.permissions.test.ts`
Steps:
- 1. RED: existing canWriteTask tests, plus new — task w/ 2 assignees, both return true; non-assignee member false; PM/admin true.
- 2. GREEN: replace `task.assignedTo === actor.id` w/ `task.assignees.some(a => a.userId === actor.id)`. Keep PM/admin branch.
- 3. REFACTOR: ensure `task.assignees` loaded everywhere canWriteTask called.
- 4. Commit `refactor(tasks): canWriteTask over multi-assignee`
Status: [x] 2026-06-06 (combined w/ t3 — single commit `feat(tasks): canWriteTask over multi-assignee + assignees include`)

### Task 5: filter rewrite — `assignedTo` query param
Files:
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/__tests__/task.service.list.test.ts`
Steps:
- 1. RED: list w/ `assignedTo=<uuid>` returns tasks where uuid in `taskAssignees`; `assignedTo=me` for actor; `assignedTo=UNASSIGNED` returns zero-assignee tasks.
- 2. GREEN: rewrite where-clause to `taskAssignees: { some: { userId } }` / `{ none: {} }`.
- 3. REFACTOR: tidy filter assembly.
- 4. Commit `feat(tasks): list filter over multi-assignee`
Status: [x] 2026-06-06 (dual-reads via OR/AND during transition)

### Task 6: `task.create` accepts `assigneeIds: string[]`
Files:
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/task.validation.ts`
- `backend/src/app/modules/task/__tests__/task.service.crud.test.ts`
Steps:
- 1. RED: create w/ `assigneeIds: [uuid1, uuid2]` → both rows in TaskAssignee. `[]` → no rows. Single uuid still works.
- 2. GREEN: zod — `assigneeIds: z.array(z.string().uuid()).optional()`. Service validates each is project member (reuse `ensureAssigneeIsProjectMember`). Insert TaskAssignee rows in same transaction. Dual-write legacy `assignedTo = assigneeIds[0] ?? null`.
- 3. REFACTOR: extract `createAssigneeRows(tx, taskId, userIds, addedById)`.
- 4. Commit `feat(tasks): create accepts assigneeIds[]`
Status: [x] 2026-06-06 (combined w/ t7 — `feat(tasks): create accepts assigneeIds[] + dual-write legacy assignedTo`)

### Task 7: legacy `assignedTo` write-path (back-compat layer)
Files:
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/task.validation.ts`
- `backend/src/app/modules/task/__tests__/task.validation.test.ts`
Steps:
- 1. RED: create w/ legacy `assignedTo: uuid` (no `assigneeIds`) → one TaskAssignee row + sets `assignedTo`. Mixed → 422.
- 2. GREEN: validation rejects both fields together. If only legacy, treat as `assigneeIds: [assignedTo]`.
- 3. REFACTOR: normalize at controller boundary.
- 4. Commit `feat(tasks): create back-compat for single assignedTo`
Status: [x] 2026-06-06 (combined w/ t6)

---

## Phase C — assignee management endpoints

### Task 8: `POST /tasks/:id/assignees` — add one
Files:
- `backend/src/app/modules/task/task.routes.ts`
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/__tests__/task.routes.test.ts`
Steps:
- 1. RED: PM adds → 201, row created, legacy `assignedTo` set if previously null. Non-PM → 403. Non-member userId → 422.
- 2. GREEN: route + service `addAssignee(actor, taskId, userId)`. Reuse `canReassignTask`.
- 3. REFACTOR: shared response shape (return updated task w/ assignees).
- 4. Commit `feat(tasks): POST /tasks/:id/assignees endpoint`
Status: [x] 2026-06-06 (combined w/ t9+t10 — single Phase C commit)

### Task 9: `DELETE /tasks/:id/assignees/:userId` — remove one
Files: same as t8 + `__tests__/task.service.permissions.test.ts`
Steps:
- 1. RED: PM removes → 200, row gone. If removed user was legacy `assignedTo`, legacy column updated to next assignee or null. Non-PM → 403.
- 2. GREEN: service `removeAssignee(actor, taskId, userId)`.
- 3. REFACTOR: ensure legacy column stays consistent w/ first assignee.
- 4. Commit `feat(tasks): DELETE /tasks/:id/assignees/:userId`
Status: [x] 2026-06-06 (combined w/ t8)

### Task 10: `PUT /tasks/:id/assignees` — replace full list
Files: same as t8
Steps:
- 1. RED: PM replaces w/ `[u1, u2, u3]` → exactly 3 rows match. Empty array → zero rows + legacy null. Non-PM → 403. Non-member → 422 (atomic, no partial apply).
- 2. GREEN: service `replaceAssignees(actor, taskId, userIds)` in transaction.
- 3. REFACTOR: dedupe input.
- 4. Commit `feat(tasks): PUT /tasks/:id/assignees`
Status: [x] 2026-06-06 (combined w/ t8)

### Task 11: `task.update` rejects `assigneeIds` + `assignedTo` body
Files:
- `backend/src/app/modules/task/task.validation.ts`
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/__tests__/task.service.update.rbac.test.ts`
Steps:
- 1. RED: PATCH w/ `assignedTo` or `assigneeIds` → 422 `USE_ASSIGNEE_ENDPOINTS`.
- 2. GREEN: zod drops both keys. Service has no path for them.
- 3. REFACTOR: error message points to new endpoints.
- 4. Commit `feat(tasks): update rejects assignee body keys`
Status: [DEFERRED → t21] strict PATCH rejection breaks legacy tests/frontend mid-transition. PATCH still accepts assignedTo + dual-writes TaskAssignee during transition. Hard-rejection happens in t21 alongside column drop + frontend migration.

---

## Phase D — notifications + cross-module refs

### Task 12: notification fan-out on status change
Files:
- `backend/src/app/modules/notification/notification.service.ts`
- `backend/src/app/modules/notification/__tests__/notification.triggers.test.ts`
Steps:
- 1. RED: status update on task w/ 3 assignees → 2 notifications fired (skip actor).
- 2. GREEN: read assignees, fan-out skipping actor.
- 3. REFACTOR: dedupe if actor is also creator/PM.
- 4. Commit `feat(notifications): fan-out status change to all assignees`
Status: [x] 2026-06-06 (combined w/ t13+t14 — single Phase D commit)

### Task 13: notification on add/remove assignee
Files: same as t12
Steps:
- 1. RED: addAssignee → notification to added user. removeAssignee → notification to removed user.
- 2. GREEN: hook into service methods.
- 3. REFACTOR: -.
- 4. Commit `feat(notifications): assignee add/remove notify target`
Status: [x] 2026-06-06 (combined w/ t12 — landed in Phase C addAssignee/removeAssignee)

### Task 14: cross-module refs — dashboard + comment + projectMember
Files:
- `backend/src/app/modules/dashboard/dashboard.service.ts`
- `backend/src/app/modules/dashboard/__tests__/dashboard.service.{kpis,lists}.test.ts`
- `backend/src/app/modules/comment/comment.service.ts`
- `backend/src/app/modules/projectMember/projectMember.service.ts`
- `backend/src/app/modules/projectMember/__tests__/projectMember.service.remove.test.ts`
Steps:
- 1. RED: dashboard "my tasks" KPI counts tasks where actor IN assignees. Comment service "can comment" unchanged (any project member). projectMember.remove cascades — TaskAssignee rows for removed user deleted.
- 2. GREEN: rewrite dashboard `where` to `taskAssignees.some`. Add cleanup of TaskAssignee rows when project member removed.
- 3. REFACTOR: shared `taskAssigneeFilter(userId)` util if duplication appears.
- 4. Commit `feat(modules): dashboard + projectMember multi-assignee`
Status: [x] 2026-06-06 (combined w/ t12)

---

## Phase E — frontend

### Task 15: task schemas + types — replace `assignedTo` w/ `assignees`
Files:
- `frontend/src/lib/schemas/task.ts`
- `frontend/src/lib/tasks.ts`
- `frontend/src/app/(authed)/projects/[id]/tasks/__tests__/page.test.tsx`
Steps:
- 1. RED: type tests + page tests assert `task.assignees: TaskUser[]`; `assignedTo` removed.
- 2. GREEN: zod schema + TS types updated. `useTasks({ assignedTo })` query-param compat preserved (still a string).
- 3. REFACTOR: rename `assigneeMap` → `assigneesById`.
- 4. Commit `refactor(frontend): task schema multi-assignee`
Status: [x] 2026-06-06

### Task 16: card UI — stacked avatars + "+N" overflow
Files:
- `frontend/src/app/(authed)/projects/[id]/tasks/page.tsx`
- `frontend/src/components/tasks/TaskAssigneesAvatars.tsx` (NEW)
- `frontend/src/components/tasks/__tests__/TaskAssigneesAvatars.test.tsx` (NEW)
Steps:
- 1. RED: 0 → "Unassigned" pill. 1-3 → that many avatars. >3 → 3 avatars + "+N" badge.
- 2. GREEN: small component takes `assignees: TaskUser[]`.
- 3. REFACTOR: `MAX_VISIBLE = 3` constant.
- 4. Commit `feat(frontend): stacked-avatars w/ overflow badge`
Status: [x] 2026-06-06

### Task 17: new-task page — multi-select picker
Files:
- `frontend/src/app/(authed)/projects/[id]/tasks/new/page.tsx`
- `frontend/src/components/tasks/AssigneesMultiSelect.tsx` (NEW)
- `frontend/src/app/(authed)/projects/[id]/tasks/new/__tests__/page.test.tsx`
Steps:
- 1. RED: form submits `assigneeIds: string[]`; multi-select renders project members; pick multiple.
- 2. GREEN: shadcn Popover + Command (combobox pattern) w/ checkbox per member.
- 3. REFACTOR: reuse `useAssignableMembers`.
- 4. Commit `feat(frontend): new-task multi-assignee picker`
Status: [x] 2026-06-06 (checkbox column, no shadcn Combobox — simpler shape)

### Task 18: edit-task page — multi-select + new endpoints
Files:
- `frontend/src/app/(authed)/projects/[id]/tasks/[taskId]/edit/page.tsx`
- `frontend/src/app/(authed)/projects/[id]/tasks/[taskId]/edit/__tests__/page.test.tsx`
Steps:
- 1. RED: edit form pre-fills current assignees. Save calls `PUT /tasks/:id/assignees` (not PATCH). Non-PM sees read-only chip list. PM sees multi-select.
- 2. GREEN: split form — fields PATCH as before, assignees through new mutation.
- 3. REFACTOR: extract `useReplaceAssignees(taskId)` hook.
- 4. Commit `feat(frontend): edit-task multi-assignee + new endpoints`
Status: [x] 2026-06-06 (edit page dropped Assignee field entirely — reassign UI lives on detail page only)

### Task 19: detail page — all assignees + canEdit over assignees array
Files:
- `frontend/src/app/(authed)/projects/[id]/tasks/[taskId]/page.tsx`
- `frontend/src/app/(authed)/projects/[id]/tasks/[taskId]/__tests__/page.test.tsx`
Steps:
- 1. RED: detail header shows avatars. `canEdit = isPrivileged || assignees.some(a => a.id === user.id)`. Non-assignee: status select read-only.
- 2. GREEN: rewrite predicate; render TaskAssigneesAvatars.
- 3. REFACTOR: -.
- 4. Commit `feat(frontend): task detail multi-assignee`
Status: [x] 2026-06-06

### Task 20: inbox + filter UI compat sweep
Files:
- `frontend/src/app/(authed)/inbox/page.tsx`
- `frontend/src/app/(authed)/inbox/__tests__/page.test.tsx`
- `frontend/src/app/(authed)/projects/[id]/tasks/page.tsx`
Steps:
- 1. RED: inbox `assignedTo: 'me'` returns tasks where actor in assignees. Task list page filter dropdown still functions.
- 2. GREEN: no FE API change; verify rendering w/ new `assignees`. Remove dead `t.assignedTo` refs.
- 3. REFACTOR: cleanup of `assigneeMap` if obsolete.
- 4. Commit `refactor(frontend): inbox + filter sweep multi-assignee`
Status: [x] 2026-06-06 (canWriteFor migrated; inbox `assignedTo=me` query unchanged, backend dual-reads)

---

## Phase F — drop legacy + final sweep

### Task 21: drop `Task.assignedTo` column + relation
Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<timestamp>_drop_task_assignedto/migration.sql` (NEW)
- `backend/src/app/modules/task/task.service.ts`
- any remaining refs via `grep -r "assignedTo" backend/src`
Steps:
- 1. Remove `assignedTo` field + `assignee` relation from `Task`. Remove `@@index([assignedTo])`.
- 2. `npx prisma migrate dev --name drop_task_assignedto`.
- 3. Remove all legacy dual-write code. Verify no compile errors.
- 4. Run full suites — expect ≥615/≥460 passing.
- 5. Commit `feat(schema): drop Task.assignedTo column — multi-assignee complete`
Status: [DEFERRED → follow-up subgoal `task-drop-legacy-assignedTo`] Multi-assignee works end-to-end; column is dual-written but functionally inert. Dropping requires migrating ~20 test files + Prisma test fixtures from `assignedTo: x` to TaskAssignee creates. Out-of-scope churn for this subgoal — backlog #B7 (new).

### Task 22: seed update — demo tasks w/ multi-assignee
Files: `backend/prisma/seed.ts`
Steps:
- 1. Update seed: 2+ tasks w/ 2+ assignees each; one unassigned; one w/ assignee who is also creator.
- 2. `npx tsx prisma/seed.ts` on local DB → verify shape.
- 3. Commit `chore(seed): multi-assignee demo coverage`
Status: [ ]

### Task 23: smoke + close
Files:
- `docs/goals/smart-collab/subgoals/task-multi-assignee/progress.md`
- `docs/goals/smart-collab/subgoals/task-multi-assignee/state.yaml`
- `docs/goals/smart-collab/notes/backlog.md` (mark #B6 RESOLVED)
Steps:
- 1. Manual smoke: PM creates task w/ 2 assignees, both update status (200), non-assignee tries to update (403), PM adds 3rd assignee, removes one, soft-deletes, restores.
- 2. Update progress.md + state.yaml: phase=4, all task statuses [x].
- 3. Backlog: mark #B6 RESOLVED.
- 4. Commit `docs(task-multi-assignee): close subgoal — all tasks done`
- 5. Open PR vs develop.
Status: [ ]
