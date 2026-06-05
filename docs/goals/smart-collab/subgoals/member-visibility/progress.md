# Progress — member-visibility

## Project
- Subgoal: member-visibility
- Started: 2026-06-05
- Last updated: 2026-06-05
- Closes: backlog #B1 (HIGH/SECURITY)

## Current Phase
Phase 3 Superpowers — DONE (t1–t13). t14 = push (already done in WIP); PR #29 pending merge.

## Locked decisions
- Enforcement at backend service layer. `actor: {id, role}` threaded from controllers via `getActor(req)`.
- admin = unrestricted. pm + member = scoped identically by ProjectMember; differ only in UI capabilities.
- Within a project: members see ALL tasks. Filter "Mine" stays available.
- Member management UX: existing `/projects/[id]/members` tab.
- Non-member access → 403 `FORBIDDEN`.
- Performance: Prisma `members.some.userId` filter → single EXISTS subquery. No N+1.
- Org/Team model deferred to backlog #B3.
- Assignee-write + soft-delete deferred to backlog #B5 (next subgoal `task-assignee-write`).

## Last Completed Task
t13 — phase 3 closed, backlog #B1 marked RESOLVED, #B5 task-assignee-write captured.

## Next Task
t14 — push final docs commits (this state.yaml + progress.md + backlog updates) to PR #29.

## Session Log
- 2026-06-05: phase 1 — 3-question brainstorm; org/team pivot captured as #B3 deferred. goal.md w/ 9 done-criteria approved.
- 2026-06-05: phase 2 — plan.md w/ 14 tasks across A backend / B controllers + invariants / C frontend / D close. state.yaml synced. Branch off develop@243b1d7. WIP PR #29 opened (docs-only).
- 2026-06-05: t1 — baseline 528 + 441. Empty commit 52a85e6.
- 2026-06-05: t2 — `Actor` type + `isAdmin` + `memberFilter` + `assertProjectAccess` helpers in project.service. Both services accept optional `actor`; missing actor = admin (backward-compat). Commit eb8871a.
- 2026-06-05: t3+t4 — `projectService.list` adds member EXISTS filter for non-admin; `findById` calls `assertProjectAccess` → 403. 12 new RBAC tests. Commit e670c36.
- 2026-06-05: t5+t6+t7 — `taskService.list` enforces project membership (cross + scoped); `findById` enforces via task.projectId. 11 new RBAC tests. Commit dbe73fc.
- 2026-06-05: t8 — controllers thread `getActor(req)` into every service call. Existing route test "all roles can list" rewritten to assert RBAC scope. New route test for creator-auto-pm invariant. Commit 06ae1db.
- 2026-06-05: t9 — covered inline in t8 (creator-auto-pm route test added there).
- 2026-06-05: t10 — already wired correctly. Members link unconditional on detail header; members page gates write actions via `isAdmin || isProjectPm`. No code change needed.
- 2026-06-05: t11 — project detail page renders friendly "no access" panel on `ApiError(403)`. Test wrapped in retry-false QueryClient. Commit 0d200fd. Pushed branch to PR #29 (52a85e6..0d200fd).
- 2026-06-05: smoke — user confirmed 3-role PASS (admin sees all, pm scoped, member scoped, 403 on direct URL, member sees all tasks in their project, members tab read-only for team_member).
- 2026-06-05: t12 + t13 — full suites green (528 + 442 — both incremented from baseline w/ new tests), typecheck + lint clean. Backlog updated: #B1 RESOLVED, #B4 captured (members-count/assignable staleness), #B5 captured (task-assignee-write next subgoal).

## Blockers
none.

## Phase Completion
- [x] Phase 1 GStack — goal.md written and user-approved 2026-06-05
- [x] Phase 2 GSD — docs/plans/member-visibility.md w/ 14 tasks
- [x] Phase 3 Superpowers — TDD execution complete (t1–t13); t14 push of closing docs pending
- [ ] Phase 4 Ralph Wiggum — multi-persona review
