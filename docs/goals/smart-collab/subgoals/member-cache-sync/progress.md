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

## Phase 2 Scout (2026-06-06, read-only code map)

### Cache-key map
| Surface | Hook | Key |
|---|---|---|
| Project detail header `Members (N)` | `useProjectMembers(id).data?.length` (page.tsx:29) | `['project-members', projectId]` |
| Members page list | `useProjectMembers(id)` | `['project-members', projectId]` |
| Task-create + task-edit assignee picker | `useAssignableMembers(projectId)` | `['project-members', projectId, 'assignable']` |
| Project list (no member count surfaced) | `useProjects()` | `['projects', {...params}]` |

### Mutation invalidation map
| Mutation | onSuccess invalidates |
|---|---|
| `useAddMember` | `['project-members', projectId]` *(prefix → covers both keys above)* |
| `useUpdateMemberRole` | `['project-members', projectId]` |
| `useRemoveMember` | `['project-members', projectId]` + `TASKS_KEY` |

### Hypothesis verdicts (from code scan, pre-smoke)
- **H1 (`useProject` cache stale for header count)**: FALSIFIED — header reads
  `useProjectMembers(...).data?.length`, NOT `project.memberCount`. Same key
  as the list page → invalidation covers it.
- **H2 (cross-tab signal missing)**: CONFIRMED. `providers.tsx:16` sets
  `refetchOnWindowFocus: false` globally and there is no BroadcastChannel
  / storage-event / SSE listener. Tab A's `invalidateQueries` is local to
  its own `QueryClient`. Tab B's cache stays stale until `staleTime: 30s`
  expires AND the component remounts (which a long-lived task-create page
  does not do).
- **H3 (`useProject` does not include `_count.members`)**: CONFIRMED as a
  consequence of H1's falsification — backend `_count` in
  `project.service.ts` is for project listing, not member count.
- **H4 (`addProjectMember` returns non-2xx in field repro)**: still to
  verify by network trace if same-tab mismatch reproduces.

### Same-tab smoke (pending user)
Code path for #B4(a) looks correct end-to-end. Need a live repro to falsify
or confirm whether:
- the mismatch was a stale-while-revalidate paint gap (cache invalidated,
  view re-rendered with `data: undefined` for a frame, then settled),
- the mismatch was already fixed during #B1 follow-up commits,
- the mismatch only appears under a specific race the code scan missed.

If smoke reproduces #B4(a) in current develop @ 5b6af5b: capture network +
react-query devtools state and add the case to "Hypothesis verdicts" before
slicing.

If smoke does NOT reproduce #B4(a) in current develop: subgoal scope
narrows to #B4(b) cross-tab + e2e + invalidation broadening.

### Cross-tab fix surface
- Touch `frontend/src/components/providers.tsx` — wrap the `QueryClient`
  setup in a `useBroadcastInvalidation(client)` effect. The effect:
  - On mount, opens `new BroadcastChannel('smart-collab-cache')`
  - Subscribes to `client.getQueryCache().subscribe(event => ...)` and
    posts `{ type: 'invalidate', queryKey }` when
    `event.type === 'updated' && event.query.state.fetchStatus === 'idle'`
    after an invalidation (or simpler: subscribe to the mutation cache and
    post on mutation success with the affected query-key prefix).
  - Listens on the channel for `{ type: 'invalidate', queryKey }` messages
    and calls `client.invalidateQueries({ queryKey, refetchType: 'active' })`.
  - `refetchType: 'active'` matters — Tab B's mounted queries refetch
    immediately; backgrounded queries refetch on next subscription.
  - No-ops when `typeof BroadcastChannel === 'undefined'`.
- New: `frontend/src/lib/broadcast-cache.ts` (helper) +
  `frontend/src/hooks/useBroadcastInvalidation.ts` (effect hook used by
  `providers.tsx`).
- Mutations stay as-is — they keep calling `invalidateQueries` locally; the
  channel just mirrors the call to other tabs.

## Phase 2 GSD — proposed task slices (draft)
- **t1** Reproduce #B4(a) + #B4(b) live; record trace + network + devtools
  state in this file. Outcome: confirm fix surface, falsify dead
  hypotheses. Read-only.
- **t2** Add cross-tab `useBroadcastInvalidation` hook + wire into
  `providers.tsx`. Unit tests: posts on local invalidate, replays remote
  invalidate, no-ops without BroadcastChannel. Files:
  `frontend/src/lib/broadcast-cache.ts`,
  `frontend/src/hooks/useBroadcastInvalidation.ts`,
  `frontend/src/components/providers.tsx`,
  `frontend/src/hooks/__tests__/useBroadcastInvalidation.test.tsx`.
- **t3** Audit + broaden invalidation surface IF t1 trace shows extra
  surfaces (e.g. add `projectKey(projectId)` if a project-level member
  count lands later). Skip if t1 surfaces nothing new.
- **t4** Add Playwright config + first e2e
  `frontend/e2e/member-cache-sync.spec.ts` covering same-tab refresh.
  Cross-tab e2e added as a second `test()` using a second `browser.newPage()`
  context.
- **t5** Smoke + close: manual two-browser-session smoke; mark
  state.yaml ralph_wiggum pending; hand off to Ralph.

## Phase 3 Superpowers — shipped (2026-06-06)
- **t1 reproduce-first**: user-run smoke on develop @ `5b6af5b` —
  #B4(a) same-tab mismatch NOT reproducible (matches Scout's code-path
  scan); #B4(b) cross-tab confirmed broken by code scan (provider has
  `refetchOnWindowFocus: false` and no peer-tab transport).
- **t2 BroadcastChannel hook** (`feat(member-cache-sync): cross-tab
  react-query invalidation via BroadcastChannel`):
  - `frontend/src/lib/broadcast-cache.ts` — channel name, message type,
    serializer, capability probe.
  - `frontend/src/hooks/useBroadcastInvalidation.ts` — subscribes to
    the QueryCache invalidate events, posts to the channel, replays
    peer messages via `invalidateQueries({ queryKey, refetchType:
    'active' })`, guards an echo loop via a `replaying` set + per-tab
    `senderId`, no-ops when `BroadcastChannel` is undefined.
  - `frontend/src/components/providers.tsx` — `CacheBroadcastBridge`
    child mounts the hook inside `QueryClientProvider`.
  - 5 new vitest tests covering: peer replay, echo-suppression, no-op
    fallback, channel-name contract, message shape. FE 457 → 462.
- **t3 invalidation broaden**: skipped — t1 surfaced no extra surface.
- **t4 Playwright e2e** (`test(member-cache-sync): playwright e2e infra
  + member-cache-sync spec`):
  - `frontend/playwright.config.ts` chromium-only, retain-on-failure
    trace + screenshot, baseURL from `E2E_BASE_URL`.
  - `frontend/e2e/member-cache-sync.spec.ts` — two scenarios: same-tab
    header-count + members-list refresh; cross-tab assignee-picker
    refresh via BroadcastChannel within 5s.
  - npm scripts `e2e`, `e2e:install`, `e2e:ui`. `.gitignore` adds
    `/test-results`, `/playwright-report`, `/playwright/.cache`.
  - `@playwright/test` pinned to `1.59.1` (npm rejected `1.60.0`
    because the core `playwright` peer dep is still alpha on 1.60).
- **t5 close**: this section + state.yaml flip to `phase: 4`,
  `phase_completion.superpowers: true`. Ralph pending.

## Verification (Phase 3)
- `cd frontend && npx tsc --noEmit` → clean.
- `cd frontend && npm test -- --run` → 462 / 462 pass (was 457 baseline,
  +5 from `useBroadcastInvalidation.test.tsx`).
- `cd frontend && npm run lint` → exit 0 (5 pre-existing react-hook-form
  / React Compiler warnings on unrelated files, no errors).
- `cd backend && npm test --silent` → 598 / 598 pass on clean run (BE
  not modified; same pre-existing `activityLog.service.list` flake
  documented in `task-drop-legacy-assignedto`).
- E2E: locally requires `npx playwright install chromium`, dev stack
  up, `DEMO_PM_PW` exported — not gated in CI yet (deferred per goal.md
  item 7).

## Deferred for follow-up subgoal / PR
- CI integration of the Playwright suite (Postgres service container +
  backend + frontend started in background + `npx playwright install
  --with-deps chromium`). Heavier CI change, isolating it keeps this
  PR reviewable.
- `@playwright/test` upgrade to 1.60.x once the core `playwright` peer
  dep ships a non-alpha 1.60 build.

## Phase Completion
- [x] Phase 1 GStack — goal.md + state.yaml + progress.md written;
      baseline recorded; intake locked
- [x] Phase 2 GSD Scout — cache-key map + mutation map + hypothesis
      verdicts + fix surface + draft slice plan written
- [x] Phase 2 GSD Judge — slice plan locked (t1..t5); decisions
      threaded into the Phase 3 commits
- [x] Phase 3 Superpowers — t1 smoke, t2 BroadcastChannel hook + tests,
      t3 skipped (no surface), t4 Playwright config + spec, t5 close
- [ ] Phase 4 Ralph Wiggum — multi-persona review

## Blockers
none
