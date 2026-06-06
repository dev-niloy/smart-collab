# Progress — task-assignee-write

## Project
- Subgoal: task-assignee-write
- Started: 2026-06-05
- Last updated: 2026-06-05
- Closes: backlog #B5 (assignee-only write + soft-delete model)

## Current Phase
Phase 3 Superpowers — DONE (t1–t16). t17 (push + PR) is the final close step.

## Locked decisions (user-confirmed 2026-06-05)
- Field write: assignee + PM + admin only. Non-assignee members read-only on task fields.
- Reassign: PM/admin only.
- Delete: PM/admin OR task creator (any role).
- Soft-delete: `deletedAt` column on Task + index. Default queries filter `deletedAt: null`.
- View deleted: PM/admin only via `?includeDeleted=true`. Non-PM passes flag → silently ignored.
- Restore: PM/admin only via new `POST /tasks/:id/restore` endpoint.
- Unassigned task status updates: PM/admin only (no member-pickup).
- Comments + attachments: open to every project member.
- Hard delete: deferred.
- Multi-assignee idea captured to backlog #B6 (next subgoal).

## Last Completed Task
t16 — state.yaml phase→3 + superpowers:true + plan tasks t1–t16 marked done; backlog #B5 marked RESOLVED; #B6 (multi-assignee) captured.

## Next Task
t17 — USER PERMISSION: push branch + open PR feature/task-assignee-write → develop

## Session Log
- 2026-06-05: phase 1 — decisions locked in backlog #B5 during member-visibility close. goal.md drafted (14 done-criteria + 7 brownfield constraints).
- 2026-06-05: phase 2 — docs/plans/task-assignee-write.md w/ 17 tasks. state.yaml synced. Branch off develop@7a13a49.
- 2026-06-05: t1 — baseline 552 + 442. Empty commit 29275a5.
- 2026-06-05: t2 — Prisma schema + migration `20260605223110_add_task_deleted_at` (column + `(projectId, deletedAt)` index). 552/552 stayed green. Commit ee6e6f0.
- 2026-06-05: t3 — `canWriteTask` + `canDeleteTask` + `canReassignTask` + `canSeeDeleted` predicates + `getProjectRoleFor` helper. 17 unit tests on the predicate matrix. Commit 886d996.
- 2026-06-05: t4 + t5 + t6 — taskService.update enforces canWriteTask + canReassignTask + unassigned-PM-only at service layer. 9 new RBAC integration tests; existing route + crud tests updated to new error codes. Commit f8e34ae.
- 2026-06-05: t7 + t8 + t9 + t10 — soft-delete (deletedAt) + canDeleteTask gate (creator-own bypass) + default `deletedAt:null` filter on all GET queries + `includeDeleted` flag silently ignored for non-PM + `POST /api/v1/tasks/:id/restore` endpoint + activityLog `task.restored`. Dropped legacy requireRole + requireTaskOwnerOrPrivileged middlewares (service-layer enforcement). 580 backend green. Commit ce2f42f.
- 2026-06-05: t11 — Task DTO + Zod schema add `deletedAt: string | null` on frontend. 10 test fixtures patched. Commit 072d6ed.
- 2026-06-05: t12 + t13 + t14 — task detail page gates Edit/Delete by (assignee && assignedTo) || isPrivileged || (creator → Delete only). InlineStatusSelect accepts `canWrite` prop → read-only Badge when false. Tasks list page renders Active/Deleted tab pair (PM/admin only). includeDeleted query param + restore mutation wired. 442/442 frontend green. Commit cc927f9.
- 2026-06-05: chore(seed) — added 2 demo projects + members + 6 tasks covering every RBAC + assignee-write case for manual smoke. Updated seed.test cleanup to drop child tables before users. Commit 6e7a8a8.
- 2026-06-05: fix — Assignee select dropdown now resolves UUID → "Name (email)" on edit + new task pages. Commit 9db86ff.
- 2026-06-05: t15 — full suites green (backend 580, frontend 442), typecheck 0 errors. 5-section user smoke PASS confirmed. Empty commit 7a36adc.
- 2026-06-05: t16 — state.yaml phase→3 + superpowers:true + next_task:t17. Plan tasks t1–t16 [x]. Backlog #B5 RESOLVED. #B6 multi-assignee captured.

## Blockers
none.

## Phase Completion
- [x] Phase 1 GStack — goal.md written and user-approved 2026-06-05 (decisions locked in backlog #B5)
- [x] Phase 2 GSD — docs/plans/task-assignee-write.md w/ 17 tasks
- [x] Phase 3 Superpowers — TDD execution complete (t1–t16); t17 push is the close gate
- [ ] Phase 4 Ralph Wiggum — multi-persona review
