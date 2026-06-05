# Plan — task-assignee-write (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/task-assignee-write/goal.md`
Branch: `feature/task-assignee-write` off `develop@7a13a49`
Mode: brownfield · feature · new session

Each task ends with a commit. RED → GREEN → REFACTOR → suite green → commit.
Internal steps stay <5 min; tasks bigger than that auto-slice during execution.

---

## Phase A — schema migration

### Task 1: baseline verification commit
Files: none
Steps:
- 1. `cd backend && npm test --silent` → expect 552 passing
- 2. `cd frontend && npm test -- --run` → expect 442 passing
- 3. Empty commit `chore: baseline before task-assignee-write work begins`
Status: [ ]

### Task 2: add `deletedAt` column to Task + migration
Files:
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/<timestamp>_add_task_deleted_at/migration.sql` (NEW)
Steps:
- 1. Add `deletedAt DateTime?` field + `@@index([projectId, deletedAt])`.
- 2. `npx prisma migrate dev --name add_task_deleted_at`.
- 3. Run existing suite to confirm no breakage.
- 4. Commit `feat(schema): add Task.deletedAt + index for soft-delete`
Status: [ ]

---

## Phase B — write-access enforcement (field updates)

### Task 3: extend Actor helpers — `canWriteTask` predicate
Files: `backend/src/app/modules/task/task.service.ts`
Steps:
- 1. RED: shape test — `canWriteTask({actor, task, projectRole})` returns true for admin / PM / assignee, false for non-assignee member.
- 2. GREEN: pure helper. Reuses `isAdmin`. Looks up projectMember role for PM check.
- 3. REFACTOR: extract `getProjectRoleFor(actor, projectId)`.
- 4. Commit `refactor(tasks): canWriteTask predicate (assignee + PM/admin)`
Status: [ ]

### Task 4: taskService.update enforces canWriteTask
Files:
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/__tests__/task.service.update.test.ts`
Steps:
- 1. RED: assignee can update status; non-assignee member → 403; PM/admin → 200.
- 2. GREEN: at top of `update`, fetch task + role; call `canWriteTask` → throw 403 if false.
- 3. REFACTOR: avoid double-fetch.
- 4. Commit `feat(tasks): update PATCH gated on canWriteTask`
Status: [ ]

### Task 5: assignedTo change restricted to PM/admin
Files: `backend/src/app/modules/task/task.service.ts`
Steps:
- 1. RED: assignee PATCHes `assignedTo` → 403 `CANNOT_REASSIGN`.
- 2. GREEN: if `input.assignedTo !== undefined` AND actor not PM/admin → 403.
- 3. REFACTOR: error code constant.
- 4. Commit `feat(tasks): assignedTo change restricted to PM/admin`
Status: [ ]

### Task 6: unassigned tasks → status updates PM/admin only
Files: `backend/src/app/modules/task/task.service.ts`
Steps:
- 1. RED: task.assignedTo === null, member PATCHes status → 403.
- 2. GREEN: `canWriteTask` returns false when task.assignedTo null AND actor not PM/admin.
- 3. REFACTOR: predicate test matrix.
- 4. Commit `feat(tasks): unassigned task status updates restricted to PM/admin`
Status: [ ]

---

## Phase C — delete (soft) + restore

### Task 7: taskService.remove → soft-delete + permission gate
Files:
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/__tests__/task.service.crud.test.ts`
Steps:
- 1. RED: PM/admin/creator can delete; non-creator member → 403.
- 2. GREEN: set `deletedAt: new Date()` (not `prisma.task.delete`). Gate on admin || project PM || task.createdBy === actor.id.
- 3. REFACTOR: helper `canDeleteTask`.
- 4. Commit `feat(tasks): soft-delete + creator/PM/admin gate`
Status: [ ]

### Task 8: all task GET queries filter `deletedAt: null` by default
Files: `backend/src/app/modules/task/task.service.ts`
Steps:
- 1. RED: soft-deleted task invisible in list + findById.
- 2. GREEN: add `deletedAt: null` to every default `where`.
- 3. REFACTOR: extract `notDeletedWhere` constant.
- 4. Commit `feat(tasks): default queries filter deletedAt:null`
Status: [ ]

### Task 9: `includeDeleted` flag — PM/admin only, silently ignored otherwise
Files:
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/task.validation.ts`
Steps:
- 1. RED: PM/admin → sees deleted; member passes flag → ignored.
- 2. GREEN: accept `includeDeleted` boolean; only honour for PM/admin.
- 3. REFACTOR: `canSeeDeleted(actor, projectRole)`.
- 4. Commit `feat(tasks): includeDeleted flag for PM/admin`
Status: [ ]

### Task 10: `POST /tasks/:id/restore` endpoint
Files:
- `backend/src/app/modules/task/task.routes.ts`
- `backend/src/app/modules/task/task.controller.ts`
- `backend/src/app/modules/task/task.service.ts`
- `backend/src/app/modules/task/__tests__/task.routes.test.ts`
Steps:
- 1. RED: PM/admin POST /restore on deleted task → 200; member → 403; non-deleted → 422 `NOT_DELETED`.
- 2. GREEN: route + controller + `restore` service (set deletedAt=null).
- 3. REFACTOR: activityLog `task.restored`.
- 4. Commit `feat(tasks): POST /restore (PM/admin only)`
Status: [ ]

---

## Phase D — frontend gates + Deleted tab

### Task 11: frontend Task DTO + Zod schema add `deletedAt`
Files: `frontend/src/lib/schemas/task.ts`
Steps:
- 1. RED: parse rejects bad shape; accepts `deletedAt: null | string`.
- 2. GREEN: optional nullable field.
- 3. REFACTOR: re-export.
- 4. Commit `feat(tasks): Task DTO includes deletedAt`
Status: [ ]

### Task 12: permission-aware UI on task detail page
Files:
- `frontend/src/app/(authed)/projects/[id]/tasks/[taskId]/page.tsx`
- corresponding test
Steps:
- 1. Pre-flight: locate exact role hooks + actions.
- 2. RED: assignee sees Edit/Delete/Status select; non-assignee member sees read-only badge + Comments form; PM/admin sees full.
- 3. GREEN: branch on `canWriteThisTask` derived from `useUser()` + `useProjectMembers()` + task.assignedTo + task.createdBy.
- 4. REFACTOR: `useTaskPermissions(task)` hook.
- 5. Commit `feat(tasks): task detail UI gates per assignee/PM/admin/creator`
Status: [ ]

### Task 13: inline status select gated on canWrite prop
Files:
- `frontend/src/components/tasks/inline-status-select.tsx`
- corresponding test
Steps:
- 1. RED: when `canWrite={false}`, render plain Badge instead of Select.
- 2. GREEN: prop + branch.
- 3. REFACTOR: keep API minimal.
- 4. Commit `feat(tasks): InlineStatusSelect read-only when canWrite=false`
Status: [ ]

### Task 14: Deleted tab on project tasks page (PM/admin only)
Files:
- `frontend/src/app/(authed)/projects/[id]/tasks/page.tsx`
- corresponding test
- `frontend/src/hooks/useTasks.ts`
Steps:
- 1. Pre-flight: confirm current tabs structure.
- 2. RED: PM/admin sees a "Deleted" tab w/ count; member does not. Click → list w/ Restore per row.
- 3. GREEN: tab + fetch w/ `?includeDeleted=true` + restore mutation.
- 4. REFACTOR: tab state in URL `?tab=deleted`.
- 5. Commit `feat(tasks): Deleted tab + Restore action for PM/admin`
Status: [ ]

---

## Phase E — close

### Task 15: full suite green + 4-role smoke
Files: none
Steps:
- 1. `cd backend && npm test --silent` → expect ≥570
- 2. `cd frontend && npm test -- --run` → expect ≥455
- 3. typecheck + lint → 0 errors
- 4. Manual smoke:
  - 4a. Assignee edits own task status → 200, live update.
  - 4b. Non-assignee member: inline status flip → 403 + revert; comment posts still 201.
  - 4c. PM: delete a task → vanishes from default list; Deleted tab shows it; Restore returns to active list.
  - 4d. team_member (creator) deletes their own task → 204; visible in PM's Deleted tab.
- 5. Commit `test: verify task-assignee-write suite green + 4-role smoke`
Status: [ ]

### Task 16: docs + close phase 3
Files:
- `docs/goals/smart-collab/subgoals/task-assignee-write/state.yaml`
- `docs/goals/smart-collab/subgoals/task-assignee-write/progress.md`
- `docs/goals/smart-collab/notes/backlog.md` (mark #B5 RESOLVED)
Steps:
- 1. Flip state.yaml phase: 3, superpowers: true, next_task: t17.
- 2. Update progress.md.
- 3. Mark #B5 RESOLVED.
- 4. Commit `docs(task-assignee-write): phase 3 superpowers complete + #B5 resolved`
Status: [ ]

### Task 17: USER PERMISSION — push + open PR
Files: none
Steps:
- 1. (USER PERMISSION) `git push -u origin feature/task-assignee-write`
- 2. (USER PERMISSION) `gh pr create --base develop --title "feat(tasks): assignee-only write + soft-delete + restore (closes #B5)"`
Status: [ ]

---

## Notes on scope discipline
- One concern per task. >2 files = slice.
- Brownfield: every task preserves goal.md Constraints (no breaking API, additive DTO, baseline stays green).
- Defer anything that creeps in (bulk restore, hard-delete, audit-trail UI).

## Goal-backward verification

| Done # | Criterion | Covered by |
|---|---|---|
| 1 | PATCH 403 for non-assignee member | t4 |
| 2 | Inline status select gated | t13 |
| 3 | Assignee field edit + no reassign | t4, t5 |
| 4 | Unassigned status PM-only | t6 |
| 5 | Delete gated (PM/admin/creator) | t7 |
| 6 | Soft-delete via deletedAt | t7 |
| 7 | Default queries filter deletedAt | t8 |
| 8 | includeDeleted PM-only | t9 |
| 9 | Restore endpoint | t10 |
| 10 | Deleted tab + Restore UI | t14 |
| 11 | Detail UI hides write controls | t12, t13 |
| 12 | New-task assignee dropdown unchanged | (existing — no change) |
| 13 | Comments/attachments unchanged | (explicit no-change) |
| 14 | Tests ≥570 / ≥455 | t15 |
