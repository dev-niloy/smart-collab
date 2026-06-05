# Goal — task-assignee-write (subgoal)

Parent: `smart-collab`
Branch: `feature/task-assignee-write` off `develop@7a13a49`
Mode: brownfield · feature · new session

---

## What
Restrict write access on Task fields to the assignee (or PM/admin). Project members who are NOT the assignee can still view the task and add comments + attachments, but cannot change status, edit fields, or reassign. Add a soft-delete model so deleted tasks remain in the DB and are visible to PM/admin via a "Deleted" tab with a Restore action. Creator (any role) can delete their own task; PM/admin can delete any task in their project.

## Why
Current model lets any project member edit any task — leaks ownership clarity, encourages stepping on teammates' work, and gives no audit trail for accidental deletes. Industry standard (Linear/Jira/Asana) is "assignee owns the task," "PM owns the board." Adds the missing accountability layer on top of the RBAC scoping shipped in `member-visibility` (#B1).

## Done looks like
1. `PATCH /api/v1/tasks/:id` returns 403 `FORBIDDEN` when actor is a project member but NOT the assignee AND NOT PM/admin. Body-level: if `assignedTo` is changed, only PM/admin may set it.
2. Same 403 rule on inline status select (which calls the same PATCH).
3. Assignee can edit own task fields (title/desc/priority/dueDate/status) — but cannot change `assignedTo` (only PM/admin can reassign).
4. Unassigned tasks (`assignedTo=null`): status + field updates restricted to PM/admin only.
5. `DELETE /api/v1/tasks/:id` succeeds for: admin, project PM, or task creator. Returns 403 for everyone else.
6. Delete is **soft**: sets `deletedAt` on the row; row stays in DB.
7. Default `GET /api/v1/tasks*` (list + detail) endpoints filter `where: { deletedAt: null }` — deleted tasks invisible in normal flows.
8. New flag `?includeDeleted=true` on `GET /api/v1/projects/:id/tasks` returns deleted tasks too. Only PM/admin may pass this flag — non-PM gets 403 or silently ignored (decision: silently ignored, no info leak).
9. `POST /api/v1/tasks/:id/restore` (new endpoint) restores a soft-deleted task. Restricted to PM/admin.
10. Frontend tasks page renders a "Deleted" tab for PM/admin only, lists soft-deleted tasks, each w/ Restore button.
11. Frontend task detail page hides Edit/Delete/Reassign buttons for non-privileged actors. Status select renders read-only (display badge, no dropdown).
12. Frontend new-task page: assignee dropdown still scoped to project members (existing behavior); newly created tasks land in projectMember scope normally.
13. Comments + attachments endpoints unchanged: every project member can read + write regardless of assignee.
14. Existing 552 backend + 442 frontend tests survive; new tests bring totals to ≥570 backend + ≥455 frontend.

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Locked decisions (user-confirmed 2026-06-05)
- **Field write capability:** assignee + PM + admin only. Non-assignee members get read-only on task fields.
- **Reassign:** PM/admin only. Assignee cannot reassign out (avoids dropping the ball without PM coordination).
- **Delete:** PM/admin OR the task creator (regardless of role). Other roles → 403.
- **Soft-delete:** new `deletedAt: DateTime?` column on Task + index `(projectId, deletedAt)`. Migration required.
- **View deleted:** PM/admin only via `?includeDeleted=true` query param or a "Deleted" tab in the tasks page. Non-PM passing the flag → flag silently ignored (no 403, no info leak).
- **Restore:** PM/admin only. New `POST /api/v1/tasks/:id/restore` endpoint.
- **Unassigned task status update:** PM/admin only. Member cannot pick up unassigned by editing status — must request PM to assign.
- **Comments + attachments:** unchanged. Every project member can comment + attach regardless of assignee.
- **Cascade on delete:** comments + attachments stay attached to soft-deleted task; visible only when viewing the deleted task in PM/admin context.
- **Hard delete:** out of scope this subgoal. Could be added later as a separate admin action.

## Constraints (brownfield)
- MUST add a non-breaking migration: `ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMP NULL;` + index on `(project_id, deleted_at)`. No data loss.
- MUST NOT change `Task` DTO shape for non-PM consumers — `deletedAt` field optional on response, always `null` for normal queries.
- MUST preserve all `member-visibility` constraints (no leak across projects).
- MUST keep the 552/442 baseline green; new tests add to count.
- MUST NOT remove or rename existing endpoints. New endpoints additive.
- MUST NOT enforce write-restriction on comment/attachment endpoints — those stay open per goal #13.
- MUST NOT regress the inline status select UX for PMs/admins/assignees — they should not see any change.

## Scope
- IN:
  - Backend: Prisma schema migration adding `deletedAt` to Task.
  - Backend: `taskService.update` / `remove` / new `restore` enforce assignee-or-PM/admin / creator-or-PM/admin / PM-or-admin respectively.
  - Backend: all task `GET` paths filter `deletedAt: null` by default. New `includeDeleted` flag.
  - Backend: new `POST /tasks/:id/restore`.
  - Frontend: hide edit/delete/reassign + read-only status select for non-privileged actors on task detail.
  - Frontend: "Deleted" tab on project tasks page (PM/admin only) + Restore button.
  - Tests: full service + route coverage; FE assertions per role + visibility tab.
- OUT:
  - Bulk delete / bulk restore.
  - Hard delete UI.
  - Reassign-on-claim ("I'll take this") UX — for now PM must assign.
  - Audit log for restore actions (existing activityLog will record on the service-level).
  - Per-field permission tiers (e.g. "can edit priority but not status").
  - Email notification on delete/restore.
- DEFERRED:
  - Hard delete admin action.
  - Trash auto-purge after N days.

## Existing Tests
- Backend: Jest — 552 baseline (must stay green; new tests add ~18-25)
- Frontend: Vitest — 442 baseline (must stay green; new tests add ~10-15)
- Coverage command (backend): `cd backend && npm test --silent`
- Coverage command (frontend): `cd frontend && npm test -- --run`

## Acceptance Criteria
Items 1–14 above. Verified by:
- Backend Jest: assignee-only PATCH on status/title/desc/priority/due (4 role × 4 op matrix). Soft-delete sets `deletedAt`; queries filter; restore clears `deletedAt`. Comments + attachments still 200 for non-assignee project members.
- Frontend Vitest: task detail page — assignee sees edit controls, non-assignee sees read-only badge + comments form. PM sees Deleted tab; member does not.
- Manual smoke (4 cases):
  - Assignee A edits status of their task → 200, badge updates live.
  - Non-assignee member B tries to change A's task status via inline dropdown → 403 toast, dropdown reverts. Comment posts still 201.
  - PM deletes a task → vanishes from default list; appears under Deleted tab w/ Restore.
  - Creator (role = team_member) deletes their own task → 204; appears in PM's Deleted tab.

## Open follow-ups (out of scope)
- Bulk operations for the Deleted tab.
- Reassign-on-claim flow if user pushback on PM-only model.
- Hard delete UI for legal/GDPR purge requests.
