# Progress — member-visibility

## Project
- Subgoal: member-visibility
- Started: 2026-06-05
- Last updated: 2026-06-05
- Closes: backlog #B1 (HIGH/SECURITY)

## Current Phase
Phase 2 GSD complete — 14 tasks sliced across A backend service scoping / B controllers + invariants / C frontend surface / D close. Ready for Phase 3 Superpowers.

## Locked decisions
- Enforcement at backend service layer (NOT route middleware). Service receives actor `{id, role}`; controllers thread `req.user`.
- admin = unrestricted. pm + member = scoped identically by ProjectMember; differ only in UI capabilities.
- Within a project: members see ALL tasks, not just their assignments. Filter "Mine" stays available.
- Member management UX: existing `/projects/[id]/members` tab. No change to project create form.
- Non-member access → 403 `FORBIDDEN` (not 404).
- Performance: Prisma `members.some.userId` filter → single EXISTS subquery. No N+1.
- Org/Team model captured to backlog as #B3 (milestone-level, explicitly deferred).

## Last Completed Task
Phase 2 GSD — plan + state populated.

## Next Task
t1 — baseline verification commit (backend 528 + frontend 441)

## Session Log
- 2026-06-05: phase 1 — user answered 3 brainstorm questions (team_member sees all tasks in project · PM scoped to membership · Members tab UX). User pivoted briefly to org/team model; captured as #B3 deferred milestone. goal.md drafted w/ 9 done-criteria + 7 brownfield constraints. User approved A (ship narrow today).
- 2026-06-05: phase 2 — docs/plans/member-visibility.md written, 14 tasks across phases A/B/C/D. state.yaml synced (phase:2, gstack:true, gsd:true, next_task:t1). Branch off develop@243b1d7.

## Blockers
none.

## Phase Completion
- [x] Phase 1 GStack — goal.md written and user-approved 2026-06-05
- [x] Phase 2 GSD — docs/plans/member-visibility.md w/ 14 tasks
- [ ] Phase 3 Superpowers — TDD execution
- [ ] Phase 4 Ralph Wiggum — multi-persona review
