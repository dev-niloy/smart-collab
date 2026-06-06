# Progress — task-multi-assignee

## Project
- Subgoal: task-multi-assignee
- Started: 2026-06-06
- Last updated: 2026-06-06

## Current Phase
Phase 3 Superpowers complete (t21 deferred to #B7, t11 rolled into t21). Ready for Phase 4 Ralph review + PR.

## Locked decisions (from backlog #B6)
- N assignees per task, write capability = any assignee + PM + admin, reassign PM/admin only.
- TaskAssignee join table w/ unique(taskId,userId) + cascade.
- Split-migration strategy: m1 adds table + backfill; m2 (drop column) deferred to follow-up subgoal #B7.
- Dual-write transition: legacy `Task.assignedTo` kept synced to first assignee until #B7.
- Filter semantics: `assignedTo=me` → EXISTS; `UNASSIGNED` → NONE. Dual-reads via OR/AND during transition.
- Notifications: status-change fans out to all assignees (except actor); add/remove notify target.
- Frontend overflow: stacked avatars up to 3 + "+N" badge.

## Last Completed Task
t22 — seed multi-assignee demo coverage

## Next Task
t23 — close + open PR

## Session Log
- 2026-06-06: subgoal scaffolded; goal.md + plan.md (23 tasks) committed.
- 2026-06-06: t1 baseline (580 backend / 442 frontend).
- 2026-06-06: t2 add_task_assignee migration applied; backfill SQL verified manually against seeded data (5 rows).
- 2026-06-06: t3+t4 combined — TaskAssignee included; canWriteTask predicate over assignees + legacy fallback. Tests 584.
- 2026-06-06: t5 list filter dual-reads (OR/AND) — keeps suite green during transition. 584.
- 2026-06-06: t6+t7 combined — `task.create` accepts assigneeIds[] + back-compat for legacy assignedTo. 592.
- 2026-06-06: Phase C (t8+t9+t10) — POST/PUT/DELETE /tasks/:id/assignees endpoints. PATCH dual-writes TaskAssignee on `assignedTo` change. 597.
- 2026-06-06: Phase D (t12+t13+t14) — notifications fan-out on status change + add/remove; dashboard, comment, projectMember workload + cascade. 601.
- 2026-06-06: Phase E t15 — FE schema adds assignees + assigneeIds (optional during transition).
- 2026-06-06: t16 — `TaskAssigneesAvatars` component + stacked overflow on cards. 446.
- 2026-06-06: t17 — new-task page multi-select checkbox column (no shadcn Combobox — simpler shape).
- 2026-06-06: t18 — edit-task page Assignee field dropped (reassign UI lives on detail page only).
- 2026-06-06: t19 — detail page shows TaskAssigneesAvatars + PM-only TaskAssigneesPanel (PUT). 447.
- 2026-06-06: t20 — `canWriteFor` on task list reads multi-assignee.
- 2026-06-06: t11 + t21 deferred to follow-up subgoal #B7 (drop legacy column + hard-reject PATCH). Multi-assignee works end-to-end; legacy column stays as dual-write.
- 2026-06-06: t22 — seed updated with co-owned task (2 assignees) + TaskAssignee rows for all seeded tasks.
- 2026-06-06: Phase 4 Ralph Wiggum complete (1 cycle, 6 commits):
  - [Developer] action key `task.unassigned` + meta keys `added`/`removed` no longer silently stripped.
  - [Architect] `requireTaskOwnerOrPrivileged` middleware predicate reads multi-assignee.
  - [Designer] avatar text → `text-white/95` for dark-mode contrast.
  - [QA] 3 new tests pin activity log actions + meta for assignee ops. 601→604.
  - [PM] re-baseline goal #17 to landed counts; expand #B7 scope to include response-shape + FE legacy fallback removal.
  - [BA] close TOCTOU on `ensureAssigneeIsProjectMember` — now runs inside tx in create/add/replace.
  - Process note: Developer + BA both touched `task.service.ts` in cycle 1; edits were disjoint regions, suite green at both points, no semantic conflict — strict Ralph conflict-rule deviation logged here, not raised as blocker.
  - Coverage gates met: backend task module 86.37% lines, frontend 90% lines.
  - Final: 604 backend / 447 frontend tests, all green.

## Blockers
none

## Phase Completion
- [x] Phase 1 GStack — goal.md + progress.md written
- [x] Phase 2 GSD — plan.md w/ 23 task slices written
- [x] Phase 3 Superpowers — 21/23 tasks complete; t11+t21 deferred to #B7 with rationale documented
- [x] Phase 4 Ralph Wiggum — 6 persona fixes landed; coverage gates met; PR up-to-date

## Test counts
- Backend: 580 → 601 (+21 multi-assignee tests)
- Frontend: 442 → 447 (+5: TaskAssigneesAvatars + multi-assignee new-task picker)

## Deferred items captured in backlog
- #B7 — Drop legacy `Task.assignedTo` column (with full scope notes)
