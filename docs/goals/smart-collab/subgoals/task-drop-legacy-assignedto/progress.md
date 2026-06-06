# Progress — task-drop-legacy-assignedto

## Project
- Subgoal: task-drop-legacy-assignedto
- Started: 2026-06-06
- Last updated: 2026-06-06

## Current Phase
Phase 2 GSD complete — plan.md w/ 8 task slices written. Ready for Phase 3 TDD starting t1.

## Locked decisions
- Single migration: drop column + drop index in one step.
- PATCH hard-reject: `assignedTo` and `assigneeIds` body keys → 422 `USE_ASSIGNEE_ENDPOINTS`.
- Frontend `Task.assignees` becomes required (no more optional during-transition).
- Test fixture shape: `prisma.task.create({ ..., assignees: { create: { userId, addedById } } })`.
- No DTO field aliasing — hard removal of `assignedTo` from API responses.
- Order locked per advisor: tests-first → PATCH-reject regression → service dual-write removal → FE flip → column drop → seed + smoke + close.

## Real blast radius (grepped 2026-06-06)
- Backend src + prisma: 25 files reference `assignedTo`
- Backend test fixture files: 15
- Frontend ref files: 15 (3 prod + 12 tests)
- Backend `task.assignee.X` relation accessor: 0 (clean — service uses raw fields)
- Frontend `task.assignee.X`: 2 files (`HighPriorityList.tsx`, `edit/page.tsx`)

## Last Completed Task
none yet — Phase 3 not started

## Next Task
t1 — baseline verification commit (expect 604/457)

## Session Log
- 2026-06-06: subgoal scaffolded via `gb init task-drop-legacy-assignedto` off `develop@9566021`.
- 2026-06-06: goal.md drafted from backlog #B7 scope (7 items).
- 2026-06-06: advisor called pre-plan — flagged real blast radius + test ordering. Grepped counts above.
- 2026-06-06: plan.md written w/ 8 tasks across 5 phases (A baseline+regression, B service, C frontend, D schema, E close).

## Blockers
none

## Phase Completion
- [x] Phase 1 GStack — goal.md + progress.md written
- [x] Phase 2 GSD — plan.md w/ 8 task slices written
- [ ] Phase 3 Superpowers — TDD execution
- [ ] Phase 4 Ralph Wiggum — multi-persona review
