# Goal — member-cache-sync (subgoal)

Parent: `smart-collab`
Branch: `feature/member-cache-sync` off `develop@ad6e121`
Mode: brownfield · feature · new session

---

## What
Close backlog #B4. After a PM adds / updates / removes a project member, the project detail header member count, the project members page list, and the task-create + edit assignee dropdowns must reflect the new state — across the active tab AND across other open tabs on the same origin — without manual reload. Add a Playwright e2e suite covering `add member → assignable dropdown refresh` so the regression is locked.

## Why
Captured during the member-visibility (#B1) smoke on 2026-06-05: PM views project header `Members (2)`, opens the members page in the same tab and sees only 1 row; in another tab, task-create's assignee dropdown is missing a member that the first tab just added. Backend is correct (verified by 23 unit + integration tests for #B1 RBAC). The bug lives in the frontend react-query cache layer: invalidation keys do not match, or queries that should refetch on focus / cross-tab broadcast do not.

The first investigation pass already located one likely root cause: `useAddMember.onSuccess` invalidates `['project-members', projectId]` but the project detail header member count is rendered from `useProject(id)` cached under `projectKey(id) = ['projects', id]`, which is never invalidated. There may be additional misses; the subgoal will reproduce the smoke flow first and then patch every miss the trace surfaces.

## Done looks like
1. Reproduction trace captured in `progress.md`: exact steps to flip from "stale" to "fresh" view, with the request/response + react-query devtools state shown for each step. No code lands before the trace is recorded.
2. Every member-related mutation hook (`useAddMember`, `useUpdateMemberRole`, `useRemoveMember`) invalidates ALL caches that surface member-derived data on success:
   - `projectMembersKey(projectId)` — members list page
   - `assignableMembersKey(projectId)` — task-create + task-edit assignee picker
   - `projectKey(projectId)` — project detail header (member count)
   - `PROJECTS_KEY` — projects list page (if it surfaces member count)
   - `TASKS_KEY` — already done for `useRemoveMember`; verify still correct
3. Cross-tab sync: a `BroadcastChannel('smart-collab-cache')` posts `{ type: 'invalidate', key: [...] }` from the mutating tab on success; a top-level effect (likely in `QueryProvider` or a new `useCrossTabInvalidation` hook) listens and calls `queryClient.invalidateQueries({ queryKey: msg.key })` in every other tab. Falls back to a no-op if `BroadcastChannel` is unavailable (older Safari).
4. Playwright e2e test (new infra) `frontend/e2e/member-cache-sync.spec.ts` covers: PM signs in → opens project detail (header shows `Members (N)`) → opens add-member form → adds a new member → header count is now `(N+1)` without page reload → opens task-create page → new member is present in the assignee dropdown without reload.
5. Vitest unit / integration tests for the hook invalidation surfaces, asserting that each mutation's `onSuccess` calls `invalidateQueries` with every key in §2 above. Net Vitest count ≥ 460 (baseline 457).
6. Backend Jest suite stays at 598 / 598 (no backend changes expected; if a backend change becomes necessary, document why and keep ≥595).
7. Playwright config + first script wired into `frontend/package.json` (`npm run e2e`) and a CI hook in `.github/workflows/ci.yml` (if present) so the suite runs on PR.
8. `progress.md` documents: trace, root causes found, each fix mapped to a misfire it closes, and the e2e + unit tests that lock it.
9. Manual smoke: a second-browser-session repro of #B4(b) (Daralmehrab task-create dropdown missing Demo Member) is fixed by the cross-tab sync.

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Locked decisions
- **Reproduce first.** No code change before the trace is captured in `progress.md`. A "I think it's X" fix is rejected.
- **Invalidate at the broadest correct key.** Default to `qc.invalidateQueries({ queryKey: ['project-members', projectId] })` style (prefix match) so future siblings like `['project-members', projectId, 'workload']` inherit invalidation automatically. Only narrow to `exact: true` if a specific cache must not refetch.
- **Cross-tab sync via BroadcastChannel.** Same-origin, same-browser only. NOT a server-push / websocket / SSE solution — those are out of scope. `BroadcastChannel` is supported in Chrome / Firefox / Edge / Safari 15.4+; fall back to no-op (focus-refetch already covers it) on unsupported.
- **Playwright over Cypress.** Playwright has better TS-first ergonomics, parallel workers by default, and ships a single binary. Cypress would require a separate dashboard for parallel runs.
- **E2E hits the real dev stack.** No mocked backend in the new e2e — that defeats the point of #B4. Test seeds its own org-scoped fixture (unique email per run) so it does not collide with manual smoke data.
- **Window-focus refetch ON for member + assignable lists.** Already react-query's default; explicitly verify `refetchOnWindowFocus !== false` in the `QueryClient` defaults config.

## Constraints (brownfield)
- MUST keep all existing RBAC (#B1), multi-assignee (#B6), and assignedTo-drop (#B7) semantics intact.
- MUST NOT break the 598 / 457 baseline. Net count may rise only.
- MUST NOT touch backend service / schema unless reproduction surfaces a backend bug (in which case scope expands by explicit `progress.md` note).
- MUST NOT introduce new runtime dependencies for cross-tab sync — `BroadcastChannel` is a Web API, no library.
- MUST NOT alter react-query default `staleTime` / `gcTime` globally — adjust per-hook only if reproduction proves it.
- MUST keep `useProjectMembers` `staleTime: 10_000` and `useAssignableMembers` `staleTime: 30_000` unless the trace proves they cause the bug.
- New Playwright config MUST NOT slow CI by more than +60s p95.

## Scope
- IN:
  - Frontend hook invalidation audit + fixes (`useAddMember`, `useUpdateMemberRole`, `useRemoveMember`, possibly `useProject`).
  - Cross-tab `BroadcastChannel` wiring in `QueryProvider` or a sibling hook.
  - Playwright config (`frontend/playwright.config.ts`), one `member-cache-sync.spec.ts` e2e, `npm run e2e` script, CI integration if `.github/workflows/ci.yml` exists.
  - Vitest unit/integration tests for hook invalidation.
  - Reproduction trace + fix log in `progress.md`.
- OUT:
  - Websocket / SSE server-push.
  - Cross-device sync (different browser, different machine).
  - Reworking react-query global defaults beyond the targeted hooks.
  - Backend changes unless reproduction proves a backend root cause.
  - Refactoring unrelated hooks for "consistency".
- DEFERRED:
  - Optimistic updates on add/remove member (could mask the cache issue but is its own feature).
  - Migrating the existing project / task hooks off prefix invalidation to a strict typed-key system.

## Existing Tests
- Backend: Jest — 598 baseline (preserved).
- Frontend: Vitest — 457 baseline; will grow.
- E2E: none today — Playwright is greenfield within this brownfield repo.
- Coverage commands:
  - backend: `cd backend && npm test --silent`
  - frontend: `cd frontend && npm test -- --run`
  - e2e: `cd frontend && npm run e2e` (new)
- Baseline passing: verified 2026-06-06 at branch off.

## Acceptance Criteria
Items 1–9 above. Verified by: full backend Jest, full frontend Vitest, new Playwright suite, manual two-browser-session smoke.

## Reproduction hypotheses (to confirm / falsify in progress.md)
- H1: `useAddMember.onSuccess` does not invalidate `projectKey(projectId)` → header member count stale.
- H2: `useAddMember.onSuccess` invalidation does not propagate to a second tab → assignable dropdown stale in tab B even though tab A is fresh.
- H3: `useProject` does not include a `_count.members` field, so the header count is computed from `useProjectMembers` after all — in which case H1 is wrong and the bug is elsewhere (e.g. enabled-flag race or stale-while-revalidate visual gap).
- H4: `addProjectMember` mutation returns a non-2xx in the field repro and `onSuccess` never fires.
