# Progress — team-members

## Project
- Name: team-members (subgoal of smart-collab)
- Started: 2026-06-04
- Last updated: 2026-06-04

## Current Phase
Phase 3 Superpowers — COMPLETE (all 22 tasks done). Phase 4 Ralph next.

## Session Log
- 2026-06-04: Phase 1 — 4 clarifications answered (add-by-email, per-project role, auto-unassign on remove, counts only). Branched feature/team-members off develop@d29f04d. Baseline backend 219/219 + frontend 143/143.
- 2026-06-04: Phase 2 — docs/plans/team-members.md sliced into 22 tasks across 6 phases.
- 2026-06-04: Phase 3 Phase A (t1-t3) — ProjectMember model + migration + backfill + idempotency verification.
- 2026-06-04: Phase 3 Phase B (t4-t8) — constants, validation, service core (add/isMember/getProjectRole/listAssignable), workload+listMembers+updateRole, removeMember tx w/ auto-unassign + last-pm guard.
- 2026-06-04: Phase 3 Phase C (t9-t13) — requireProjectRole middleware (admin bypass), controller+routes mounted as project child router, integration negatives, project.service auto-PM in tx, task.service ASSIGNEE_NOT_PROJECT_MEMBER guard + admin bypass.
- 2026-06-04: Phase 3 Phase D (t14-t16) — frontend schemas + api client, format helpers, hooks (useProjectMembers/useAssignableMembers/useAddMember/useUpdateMemberRole/useRemoveMember invalidates members AND tasks).
- 2026-06-04: Phase 3 Phase E (t17-t21) — members list page, MemberCard, AddMemberForm (RHF+Zod), RemoveMemberButton (AlertDialog), RoleSelect, refactor 3 task assignee pickers to useAssignableMembers, project detail Members link.
- 2026-06-04: Phase 3 Phase F (t22) — coverage check + README updates.

## Last Completed Task
Phase 3 t22 — coverage verified + README API table + frontend pages updated.

## Next Task
Phase 4 Ralph Wiggum — `/ralph-wiggum feature/team-members` review loop.

## Final test counts
- Backend: 286/286 jest (baseline 219 + 67 new) — projectMember module 94-100% lines, requireProjectRole 87.5% lines
- Frontend: 197/197 vitest (baseline 143 + 54 new) — members module 92-100% lines, hooks 100% lines

## Blockers
none

## Phase Completion
- [x] Phase 1 GStack — SPEC.md (goal.md) written and complete
- [x] Phase 2 GSD — docs/plans/team-members.md written and all 22 tasks listed
- [x] Phase 3 Superpowers — all 22 tasks checked off, suite passing (backend 286/286, frontend 197/197)
- [ ] Phase 4 Ralph Wiggum — [DONE] output received

## Subgoal commits (Phase 3, chronological)
- c345b60 [A1] prisma model + migration
- eea4579 [A2+A3] backfill migration + verification
- e439a8e [B4] constants
- ddf5f8f [B5] zod validation + 10/10
- 4a... (or similar) [B6] service core + 10/10
- 37c6003 [B7] listMembers + workload + updateRole + 7/7
- 7d58fd5 [B8] removeMember tx + 6/6
- (then C9-C13, D14-D16, E17-E21, F22)
