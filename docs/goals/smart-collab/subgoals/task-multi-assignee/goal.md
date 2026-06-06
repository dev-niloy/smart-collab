# Goal — task-multi-assignee (subgoal)

Parent: `smart-collab`
Branch: `feature/task-multi-assignee` off `develop@bd9d622`
Mode: brownfield · feature · new session

---

## What
Replace single-assignee model (`Task.assignedTo: String?`) with multi-assignee model: a Task can have N assignees via a new `TaskAssignee(taskId, userId, addedById, addedAt)` join table. Any assignee can edit task fields + status. Only PM/admin can add/remove assignees (reassign). Card UI shows stacked avatars + "+N" overflow. New/edit forms use multi-select picker scoped to project members. Migration backfills each non-null `assignedTo` into a single `TaskAssignee` row, then drops the old column.

## Why
Industry standard (Linear/Jira/Asana): tasks frequently need 2-3 collaborators (designer + engineer, FE + BE). Current single-FK model forces choosing one "owner," blocking real ownership models and breaking write access for collaborators who need to update status. Multi-assignee + assignee-write (#B5) together complete the ownership story.

## Done looks like
1. New `TaskAssignee` table created with `(taskId, userId, addedById, addedAt)` + unique `(taskId, userId)` + cascade on Task delete + indexes on `(taskId)` and `(userId)`.
2. Migration backfills: every existing non-null `Task.assignedTo` becomes one `TaskAssignee` row (`addedById = Task.createdBy`, `addedAt = Task.createdAt`).
3. Migration drops `Task.assignedTo` column AFTER backfill, in same migration (or follow-up migration if Prisma forces split). No data loss.
4. `task.create` accepts `assigneeIds: string[]` (0..N). `task.update` does NOT accept `assigneeIds` — assignment via separate endpoints.
5. New endpoints:
   - `POST /api/v1/tasks/:id/assignees` body `{ userId }` — PM/admin only — add one assignee.
   - `DELETE /api/v1/tasks/:id/assignees/:userId` — PM/admin only — remove one assignee.
   - `PUT /api/v1/tasks/:id/assignees` body `{ userIds: string[] }` — PM/admin only — replace full list.
6. Every assigneeId on create + every userId on add/replace must be a project member of the task's project. Otherwise 422 `INVALID_INPUT`.
7. `canWriteTask(actor, task)`: `actor.id IN task.assignees[].userId` OR PM/admin. Replaces single-FK check.
8. `canReassignTask(actor, task)`: PM/admin only (unchanged from #B5 semantics, new endpoints).
9. `canDeleteTask` + `canSeeDeleted` + soft-delete + restore: unchanged from #B5.
10. `GET /api/v1/projects/:id/tasks?assignedTo=<userId>` filter: tasks where userId is in assignees. `assignedTo=me`: actor in assignees. `assignedTo=UNASSIGNED`: tasks with zero assignees.
11. Task list + detail response: `assignedTo` removed. New field `assignees: TaskUser[]` (each id/name/email), ordered by `addedAt`.
12. Comments + attachments unchanged: any project member can read/write regardless of assignee count.
13. Notifications fan-out: status change → notify all assignees (except actor). Reassign add → notify added user. Reassign remove → notify removed user.
14. Frontend task card UI: stacked avatars showing up to 3 assignees + "+N" badge for overflow. Empty state: "Unassigned" pill.
15. Frontend new-task + edit pages: multi-select picker (shadcn Combobox w/ multiple selection OR stacked checkbox list) listing project members. Pre-fills with current assignees on edit.
16. Frontend filter UI ("My tasks" toggle): unchanged externally; under the hood uses `assignedTo=me` semantics over new model.
17. Existing 580 backend + 442 frontend tests survive. New tests bring totals to ≥615 backend + ≥460 frontend.

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Locked decisions (user-confirmed 2026-06-05, backlog #B6)
- **N assignees per task.** Industry standard.
- **Write capability:** any assignee + PM + admin. Read-only for non-assignee members.
- **Reassign (add/remove/replace assignees):** PM/admin only.
- **Schema:** new `TaskAssignee(taskId, userId, addedById, addedAt)` join table w/ unique `(taskId, userId)` + cascade on Task delete + indexes `(taskId)` + `(userId)`.
- **Migration:** backfill each non-null `Task.assignedTo` → one `TaskAssignee` row, THEN drop `Task.assignedTo`. Single migration if Prisma allows; split otherwise.
- **Validation:** every assignee must be project member of the task's project.
- **Filters:** `assignedTo=me` → EXISTS on TaskAssignee. `UNASSIGNED` → no TaskAssignee rows.
- **Comments + attachments:** unchanged — every project member can read/write.
- **Notifications:** fan-out on status change to all assignees (except actor); notify added/removed on reassign.
- **Frontend overflow:** stacked avatars, up to 3 + "+N" badge.

## Constraints (brownfield)
- MUST preserve data via backfill — no existing `assignedTo` value lost. Verified on local DB w/ seed before merge.
- MUST drop `Task.assignedTo` only after backfill succeeds. Split migrations if Prisma forces it; document both in plan.
- MUST remove `assignee` Prisma relation + `TaskAssignedTo` relation name cleanly.
- MUST keep all `task-assignee-write` (#B5) RBAC: soft-delete, restore, canDeleteTask, canSeeDeleted unchanged. Only `canWriteTask` predicate shape changes.
- MUST keep all `member-visibility` (#B1) RBAC: project-scoped access, 403 on non-member.
- MUST not break the 580/442 baseline. New tests add.
- MUST not remove or rename existing task endpoints.
- MUST keep `assignedTo` query param compat on `GET /projects/:id/tasks` (userId / `me` / `UNASSIGNED`) — frontend filter contract.
- MUST not regress comments/attachments — any project member still posts.
- API: `assignedTo` field REMOVED from response. Frontend updated in same PR (single deployable unit; no two-phase API tolerated yet).

## Scope
- IN:
  - Backend: Prisma schema — add `TaskAssignee`, drop `Task.assignedTo` + `assignee` relation.
  - Backend: migration w/ backfill SQL.
  - Backend: `taskService.create` accepts `assigneeIds: string[]`; validates membership; creates join rows.
  - Backend: `canWriteTask` rewritten over TaskAssignee.
  - Backend: new assignee endpoints (POST/DELETE/PUT).
  - Backend: filter rewrites for `assignedTo=me|UNASSIGNED|<uuid>`.
  - Backend: notifications fan-out on status change + reassign.
  - Backend: seed updated for multi-assignee demo tasks.
  - Frontend: task schemas — replace `assignedTo` with `assignees`.
  - Frontend: card UI stacked avatars + overflow badge.
  - Frontend: new + edit pages multi-select picker.
  - Frontend: "My tasks" filter unchanged externally.
  - Tests: full service + route coverage; FE per role + multi-assignee scenarios.
- OUT:
  - Per-assignee role differentiation (primary vs secondary). All assignees equal.
  - Assignee-specific subtasks.
  - Self-assign / "I'll take this" UX — still PM/admin only.
  - Bulk assignee changes across tasks.
  - Email notifications (in-app activityLog only).
- DEFERRED:
  - Primary assignee distinction (optional `isPrimary` on TaskAssignee later).
  - Self-assign for non-PM members.

## Existing Tests
- Backend: Jest — 580 baseline (must stay green; new tests add ~25-35)
- Frontend: Vitest — 442 baseline (must stay green; new tests add ~15-20)
- Coverage command (backend): `cd backend && npm test --silent`
- Coverage command (frontend): `cd frontend && npm test -- --run`
- Baseline passing: yes (verified at t1)

## Acceptance Criteria
Items 1–17 above. Verified by: backend Jest suite, frontend Vitest suite, manual seed-based smoke (PM creates task w/ 2 assignees, both update status, non-assignee gets read-only, PM adds 3rd assignee, removes one, deletes task, restores).
