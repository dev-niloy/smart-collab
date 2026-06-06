# Progress — task-drop-legacy-assignedto

## Project
- Subgoal: task-drop-legacy-assignedto
- Started: 2026-06-06
- Last updated: 2026-06-06

## Current Phase
Phase 3 Superpowers complete. Ready for Phase 4 Ralph review + PR.

## Final test counts
- Backend: 604 → 598 (-6). Retired tests: REASSIGN_COMPLETED via PATCH (x2 service + x2 route), back-compat legacy assignedTo, both-fields-rejected validation, diff "does not emit assigned when unchanged", diff "emits both". Added: PATCH-reject USE_ASSIGNEE_ENDPOINTS x2. Net within ≥595 goal.
- Frontend: 457 → 457 (no net change). Type flip mechanical.

## Last Completed Task
t7 — drop Task.assignedTo column migration applied

## Next
PR + Ralph cycle.

## Session Log
- 2026-06-06: subgoal scaffolded; goal.md + plan.md (8 tasks) committed.
- 2026-06-06: t1 baseline 604/457.
- 2026-06-06: t2 migrate 15 backend test fixtures to TaskAssignee shape; dropped REASSIGN_COMPLETED + back-compat tests. 597.
- 2026-06-06: t3+t4 combined — PATCH hard-reject USE_ASSIGNEE_ENDPOINTS via route middleware (zod would silently strip and trip generic VALIDATION_ERROR); service.update + create drop all legacy assignedTo paths. 599.
- 2026-06-06: t5 — drop legacy dual-read across task.service (canWriteTask, buildAssignedToWhere, ensureAssigneeIsProjectMember client param, syncLegacyAssignedTo deleted, current/existing selects), task.ownership middleware, dashboard.getKpis + getHighPriority, projectMember.buildWorkloadMap + removeMember, comment.service. 598.
- 2026-06-06: t6 — frontend Task type drops assignedTo + assignee; assignees required. 8 test fixture files updated. tasks.ts list-filter test uses 'unassigned' literal. canWriteFor + edit-page picker + detail page predicate all simplified. FE 457/457.
- 2026-06-06: t7 — migration 20260606063159_drop_task_assignedto: DROP INDEX + CONSTRAINT + COLUMN. Prisma schema removes Task.assignedTo + assignee relation + User.tasksAssigned inverse. taskInclude drops assignee. seed.ts removes assignedTo writes. Applied locally. BE 598/598.

## Phase Completion
- [x] Phase 1 GStack — goal.md + progress.md written
- [x] Phase 2 GSD — plan.md w/ 8 task slices written
- [x] Phase 3 Superpowers — all 8 tasks complete (t8 = close)
- [ ] Phase 4 Ralph Wiggum — multi-persona review

## Blockers
none
