# Progress — member-cache-sync

Branch: `feature/member-cache-sync` off `develop@ad6e121`
Started: 2026-06-06

## Baseline (recorded 2026-06-06)
- Backend Jest: 598 / 598 passed (one observed flake on
  `activityLog.service.list › listGlobal returns null nextCursor at end`
  under suite-wide DB residue; passes on retry — carried over from
  task-drop-legacy-assignedto progress.md)
- Frontend Vitest: 457 / 457 passed
- Playwright: not installed yet (greenfield in this repo)

## Locked intake (from goal.md)
- `completion_proof`: `cd frontend && npm run e2e -- member-cache-sync.spec.ts`
  exits 0 AND `cd backend && npm test --silent` ≥ 598 AND
  `cd frontend && npm test -- --run` ≥ 460
- `likely_misfire`: invalidate keys that do not match real useQuery keys
  (silent miss), e2e asserts UI state before refetch settles (false-green),
  BroadcastChannel only same-browser so cross-browser-session smoke from
  #B4(b) stays broken silently

## Working hypotheses (to confirm in Phase 2 reproduction trace)
- **H1**: `useAddMember.onSuccess` does not invalidate `projectKey(projectId)` →
  project header member count stale until manual reload.
- **H2**: invalidation does not propagate to a second tab → assignable
  dropdown stale in tab B even though tab A is fresh.
- **H3**: header member count may come from `useProjectMembers` length, not a
  server `_count.members` field — in which case H1 is wrong and the cause is
  a different miss (verify by reading the project detail page render path).
- **H4**: `addProjectMember` mutation may return non-2xx in the field repro
  → `onSuccess` never fires → no invalidation at all.

## Phase Completion
- [x] Phase 1 GStack — goal.md + state.yaml + progress.md written; baseline
      recorded; intake locked
- [ ] Phase 2 GSD — reproduction trace + task slicing (plan.md)
- [ ] Phase 3 Superpowers — execute task slices
- [ ] Phase 4 Ralph Wiggum — multi-persona review

## Blockers
none
