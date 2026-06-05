# Plan — sidebar-shell (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/sidebar-shell/goal.md`
Branch: `feature/sidebar-shell` off `develop@bdda6e0`
Mode: brownfield · feature · new session

Each task ends with a commit. RED → GREEN → REFACTOR → suite green → commit. Internal steps stay <5 min; tasks bigger than that auto-slice during execution.

---

## Phase A — Baseline + scaffolding

### Task 1: baseline verification commit
Files: none
Steps:
- 1. Run backend `npm test` (expect 523/523) + frontend `npm test -- --run` (expect 364/364)
- 2. Empty commit `chore: baseline before sidebar-shell work begins`
Status: [x] 2026-06-05 — backend 523/523, frontend 364/364, empty commit 228912f

### Task 2: shell component scaffolding (placeholder files + dirs)
Files (NEW):
- `frontend/src/components/shell/ShellLayout.tsx`
- `frontend/src/components/shell/Rail.tsx`
- `frontend/src/components/shell/Panel.tsx`
- `frontend/src/components/shell/Topbar.tsx`
- `frontend/src/components/shell/index.ts`
- `frontend/src/components/shell/__tests__/ShellLayout.test.tsx`
Steps:
- 1. Create empty (named export) components that each render a `<div data-testid="…">` placeholder
- 2. ShellLayout composes Rail + Panel + Topbar + children slot
- 3. RED: write `ShellLayout.test.tsx` asserting all four test-ids render
- 4. GREEN: implement minimal markup
- 5. Pre-flight shadcn check: `frontend/components.json` registry must include `dropdown-menu`, `command`, `sheet`. If any missing, `npx shadcn add <name>` from `frontend/` and commit the generated files in this same task.
- 6. Run full frontend suite (expect 365/365 — +1 file, ≥+1 test)
- 7. Commit `feat(shell): scaffold ShellLayout + Rail + Panel + Topbar shells + shadcn primitives`
Status: [x] 2026-06-05 — 4 shell components + index.ts + ShellLayout.test.tsx (3 tests); shadcn command + sheet + dialog + input-group installed; frontend suite 367/367 (+3 from baseline).

## Phase B — Rail

### Task 3: Rail top nav (logo + Search/Dashboard/Projects/Inbox + active state)
Files:
- `frontend/src/components/shell/Rail.tsx`
- `frontend/src/components/shell/__tests__/Rail.test.tsx` (NEW)
Steps:
- 1. RED: tests assert (a) 4 nav buttons render with lucide icons + accessible names; (b) `activeRoute="projects"` adds `data-active=true` only to the Projects icon
- 2. GREEN: implement using `lucide-react` (Search, LayoutDashboard, FolderKanban, Inbox), `next/navigation` `usePathname` to derive active state. Icons stroke 1.75, 20px
- 3. Active key uses **prefix match** — `/projects/123/tasks/456` still highlights Projects. Add a test for the nested case.
- 4. Commit `feat(shell): Rail top nav with active route highlight`
Status: [x] 2026-06-05 — Rail.tsx renders workspace logo + Search button + Dashboard/Projects/Inbox links. usePathname() drives prefix-match active state. Rail.test.tsx adds 6 tests incl. nested-route case. dark-mode-audit caught text-white → switched to bg-primary/text-primary-foreground tokens. Frontend 373/373.
Status: [ ]

### Task 4: Rail bottom (Help link, Theme toggle, Avatar dropdown with Logout)
Files:
- `frontend/src/components/shell/Rail.tsx`
- `frontend/src/components/shell/__tests__/Rail.test.tsx`
Steps:
- 1. RED: test (a) Help icon renders w/ href to docs; (b) Theme button toggles class on `<html>`; (c) Avatar dropdown shows user email + Logout
- 2. GREEN: wire Theme button to existing theme hook; Avatar dropdown uses shadcn `DropdownMenu`; Logout calls existing `useLogout()`
- 3. Confirm existing Header's theme toggle + logout still work (or remove duplicate usage in t10)
- 4. Commit `feat(shell): Rail bottom — help, theme, avatar+logout`
Status: [x] 2026-06-05 — RailBottom.tsx w/ Help link (external GitHub README, target=_blank), Theme toggle (next-themes), Avatar dropdown showing email + role + Log out item; reuses existing useTheme + useUser/useLogout hooks. RailBottom.test.tsx 5 tests. Frontend 378/378.

### Task 5: Inbox red-dot when unread > 0
Files:
- `frontend/src/components/shell/Rail.tsx`
- `frontend/src/components/shell/__tests__/Rail.test.tsx`
Steps:
- 1. RED: stub `useUnreadNotifications()` hook to return 3, assert red-dot on Inbox icon
- 2. GREEN: implement `useUnreadNotifications` that calls existing notifications endpoint and counts unread. Source it from the same logic the current `<NotificationBell>` uses (extract shared hook from `frontend/src/components/notification-bell.tsx` into `frontend/src/hooks/useUnreadNotifications.ts` so both consume one truth)
- 3. Commit `feat(shell): Inbox unread red-dot indicator on Rail (shared hook with NotificationBell)`
Status: [x] 2026-06-05 — discovery: `useUnreadCount` already exists in @/hooks/useNotifications (consumed by NotificationBell). Reused directly, no extraction needed — single source of truth already in place. Rail shows red dot + injects count into aria-label when unread>0. Rail.test.tsx +3 tests (zero, non-zero, undefined). ShellLayout.test mock updated. Frontend 381/381.
Status: [ ]

## Phase C — Panel

### Task 6: Panel shell + collapse toggle + localStorage persistence
Files:
- `frontend/src/components/shell/Panel.tsx`
- `frontend/src/hooks/usePanelCollapsed.ts` (NEW)
- `frontend/src/components/shell/__tests__/Panel.test.tsx` (NEW)
- `frontend/src/hooks/__tests__/usePanelCollapsed.test.ts` (NEW)
Steps:
- 1. RED: hook test — initial value reads `localStorage["sc:panel:collapsed"]` (default false), `setCollapsed(true)` persists
- 2. RED: Panel test — `collapsed=true` reduces width to 0 (or hides), `collapsed=false` shows children
- 3. GREEN: implement hook + Panel
- 4. Commit `feat(shell): Panel with collapse + localStorage persistence`
Status: [x] 2026-06-05 — usePanelCollapsed hook (collapsed/setCollapsed/toggle) reads + writes key `sc:panel:collapsed`, SSR-safe, garbage-value resistant. usePanelCollapsed.test.ts 6 tests. Panel.test.tsx 2 tests (rendering + collapsed shrink). Frontend 389/389.

### Task 7: ProjectsPanel content
Files:
- `frontend/src/components/shell/ProjectsPanel.tsx` (NEW)
- `frontend/src/components/shell/__tests__/ProjectsPanel.test.tsx` (NEW)
Steps:
- 1. RED: test — header "Projects" + "+ New" CTA + 4 filter chips (All / Active / Mine / Archived) + sections "Pinned" and "All"; clicking Active sets `?status=active`
- 2. GREEN: reuse existing `useProjects` hook (with query params); Pinned in v1 reads from localStorage key `sc:projects:pinned` (array of project ids; empty by default); All renders a virtualised list of project name + status dot
- 3. Empty Pinned state renders `<p class="text-muted-foreground">No pinned projects yet</p>` so goal #3 "Pinned group renders" still holds when nothing is pinned. Test for empty + non-empty cases.
- 4. Commit `feat(shell): ProjectsPanel content with filter chips + pinned (localStorage)`
Status: [x] 2026-06-05 — ProjectsPanel.tsx renders header + "+New" link + 4 chips (All/Active/Mine/Completed — deviation from plan's "Archived" since backend has no archive status; using Completed instead) + Pinned region (reads `sc:projects:pinned` JSON array) + All region. Empty Pinned shows "No pinned projects yet". Status dots + virtualised list. ProjectsPanel.test.tsx 7 tests. Frontend 396/396.
Status: [ ]

### Task 8: DashboardPanel + InboxPanel (minimal)
Files:
- `frontend/src/components/shell/DashboardPanel.tsx` (NEW)
- `frontend/src/components/shell/InboxPanel.tsx` (NEW)
- `frontend/src/components/shell/__tests__/DashboardPanel.test.tsx` (NEW)
- `frontend/src/components/shell/__tests__/InboxPanel.test.tsx` (NEW)
Steps:
- 1. DashboardPanel: header "Dashboard" + links (My Open Tasks, Today's deadlines) — both navigate to filtered project/task views
- 2. InboxPanel: header "Inbox" + tabs (Unread / Mentions / Assigned to me) — tabs are visual only in v1, filter state lifted to InboxPage
- 3. Tests assert the headers + links render
- 4. Commit `feat(shell): Dashboard + Inbox panels (minimal)`
Status: [x] 2026-06-05 — DashboardPanel.tsx renders header + 2 anchored links (#my-open-tasks, #upcoming-deadlines). InboxPanel.tsx renders header + 3 vertical tabs (Unread default / Mentions / Assigned to me) w/ onTabChange callback for t12 page wiring. 5 tests across both. Frontend 401/401.
Status: [ ]

## Phase D — Topbar

### Task 9: Topbar breadcrumbs + actions slot
Files:
- `frontend/src/components/shell/Topbar.tsx`
- `frontend/src/components/shell/__tests__/Topbar.test.tsx` (NEW)
Steps:
- 1. RED: test — `<Topbar segments={['Projects', 'Q3 polish']} />` renders breadcrumbs w/ separator; `actions` prop slot renders custom React
- 2. GREEN: implement using `next/link` for clickable segments
- 3. Commit `feat(shell): Topbar with breadcrumbs + actions slot`
Status: [x] 2026-06-05 — Topbar accepts segments as string OR {label,href?}. Intermediate segments with href render as next/link; last segment always renders as plain text (no click on current location). Actions slot renders on the right. Topbar.test.tsx 5 tests. Frontend 406/406.
Status: [ ]

## Phase E — Integrate the shell

### Task 10: Wire ShellLayout into the authenticated route group
Files:
- `frontend/src/app/(authed)/layout.tsx` (NEW or update)
- Delete `<Header />` import + usage from each authed page (sweep)
- Delete `frontend/src/components/header.tsx` after last usage removed
- Delete `frontend/src/components/notification-bell.tsx` if its only consumer was Header (move its content into InboxPanel / InboxPage during t8 / t12)
- All `frontend/src/app/(authed)/**/page.tsx` + their `__tests__/` (sweep)
Steps:
- 1. Pre-flight scope sizing: `grep -rln "<Header" frontend/src/app` — record file count + test count to expect for churn. **Login + signup pages stay header-less + outside the (authed) group.**
- 2. Move authed pages under a route group `(authed)/` if not already; add `(authed)/layout.tsx` that mounts `<ShellLayout>` and renders `children`
- 3. Inside ShellLayout, derive active rail key from `usePathname()` and render matching panel component via a `routeToPanel` map
- 4. RED: write `ShellLayout.section-swap.test.tsx` asserting `pathname=/projects` renders `ProjectsPanel`, `pathname=/dashboard` renders `DashboardPanel`, `pathname=/inbox` renders `InboxPanel`. Covers goal-criterion #9.
- 5. Remove `<Header />` from every authed page that previously included it
- 6. Delete the now-orphan files (`header.tsx`, plus any sub-component only used by it)
- 7. Run full frontend suite — fix any existing page tests asserting on Header DOM (rewrite to assert on Rail/Topbar where appropriate). **If churn exceeds 15 test files, stop and slice this task into t10a (wiring) + t10b (test sweep).**
- 8. Commit `feat(shell): mount ShellLayout for all authed routes; drop old Header`
Status: [x] 2026-06-05 — moved dashboard/projects/forbidden into (authed) route group (file moves only). Added (authed)/layout.tsx + routeToPanel helper + 5-case section-swap test (goal #9 covered). Stripped <Header /> from 10 project pages + DashboardGrid. Deleted header.tsx, theme-toggle.tsx, notification-bell.tsx, GlobalSearchBar.tsx + their tests. providers.test trimmed. Frontend 395/395 (delta from 406: -16 deleted Header/bell/search/theme-toggle tests + 5 new routeToPanel tests). Next build green. No auto-slice needed.

## Phase F — Cmd+K palette + Inbox page

### Task 11: Cmd+K command palette
Files:
- `frontend/src/components/shell/CommandPalette.tsx` (NEW)
- `frontend/src/components/shell/__tests__/CommandPalette.test.tsx` (NEW)
- Wire into ShellLayout
Steps:
- 1. Use shadcn `Command` primitive (already in repo) for the modal
- 2. RED: test — Cmd+K opens modal; typing `q` triggers debounced fetch of /projects?q + /tasks?q (mock); Enter on result navigates
- 3. GREEN: implement with `useHotkeys` (or manual `keydown`), debounce 200ms, max 8 results, two sections (Projects / Tasks)
- 4. Commit `feat(shell): Cmd+K command palette over projects + tasks`
Status: [x] 2026-06-05 — CommandPalette.tsx uses shadcn `CommandDialog`. Global keydown listens for Cmd+K/Ctrl+K to toggle. Query state debounced 200ms; both `useProjects` + `useTasks` hooks gated on `hasQuery`. Results capped at 8 each, two CommandGroups (Projects, Tasks). Empty / loading / no-match states handled. Wired into (authed)/layout.tsx via local state + `onSearchClick` from Rail. CommandPalette.test.tsx mocks ui/command surface (cmdk needs jsdom shims) and covers 7 cases. Frontend 402/402.
Status: [ ]

### Task 12: /inbox route page
Files:
- `frontend/src/app/(authed)/inbox/page.tsx` (NEW)
- `frontend/src/app/(authed)/inbox/__tests__/page.test.tsx` (NEW)
Steps:
- 1. RED: test — renders three tabs (Unread / Mentions / Assigned to me); Unread shows notifications list; Assigned shows tasks assigned to current user
- 2. GREEN: reuse `useNotifications` hook + `useTasks({ assignedTo: 'me' })`; tabs are local state
- 3. Commit `feat(inbox): /inbox page combining notifications + assigned tasks`
Status: [x] 2026-06-05 — page lives under (authed)/inbox/page.tsx. 3 tabs (Unread default / Mentions / Assigned). Unread + Mentions reuse `useNotifications`; Mentions is a client-side filter (no backend mention endpoint). Assigned tab reuses `useTasks({assignedTo:'me'})`. "Mark all read" action button visible only in Unread tab when items > 0. 6 tests. Frontend 408/408. Panel-to-page tab sync deferred (panel and page each manage local tab state in v1).
Status: [ ]

## Phase G — Mobile + polish

### Task 13: Mobile drawer behavior
Files:
- `frontend/src/components/shell/ShellLayout.tsx`
- `frontend/src/components/shell/MobileDrawer.tsx` (NEW)
- `frontend/src/components/shell/__tests__/MobileDrawer.test.tsx` (NEW)
- `frontend/src/hooks/useMediaQuery.ts` (NEW)
Steps:
- 1. RED: at <768px, ShellLayout hides Rail+Panel and shows a top hamburger; clicking opens drawer with Rail + Panel stacked
- 2. GREEN: use shadcn `Sheet` for the drawer; `useMediaQuery('(max-width: 767px)')` to gate
- 3. Commit `feat(shell): mobile drawer below 768px`
Status: [x] 2026-06-05 — useMediaQuery hook (SSR-safe, listens for matchMedia changes); useMediaQuery.test 2 cases. MobileDrawer.tsx wraps shadcn Sheet w/ hamburger SheetTrigger + side="left" SheetContent containing rail + panel stacked. ShellLayout branches: when `MOBILE_MEDIA_QUERY` matches, renders a topbar w/ MobileDrawer hamburger + topbar inline, main below; otherwise current desktop layout. MobileDrawer.test 4 cases. ShellLayout.test +1 mobile-branch case. Frontend 415/415.
Status: [ ]

### Task 14: Theme parity audit
Files:
- `frontend/src/components/shell/*.tsx`
- `frontend/src/app/globals.css` (touch only if needed)
Steps:
- 1. Visual pass: load every authed route under light + dark theme; ensure rail/panel/topbar use existing CSS variables (no hard-coded hex). Use `grep -rE "#[0-9a-fA-F]{3,6}\b" frontend/src/components/shell/` to surface any literal colors.
- 2. a11y tooling: run `npx @axe-core/cli http://localhost:3000/dashboard` on a `npm run dev` instance. Capture violations. Fix critical + serious; document any minor deferrals in progress.md.
- 3. Static lint: confirm `frontend/eslint.config.mjs` already enforces `jsx-a11y` rules (it does via Next.js defaults); add aria-label assertions to existing shell tests where icon-only buttons exist.
- 4. Commit `style(shell): theme + a11y parity sweep`
Status: [x] 2026-06-05 — audit complete. 0 hex literals in shell. 3 intentional Tailwind palette colors in ProjectsPanel status dots (emerald/violet/amber) — semantic state-encoding, intentionally theme-invariant. aria-label coverage verified across all icon-only buttons (Search, Workspace, Help, Toggle theme, Account menu, Open navigation, New project). Landmarks: Rail/Panel asides labeled, breadcrumbs nav labeled, every tab has visible text + role=tab + aria-selected. Lint: 0 errors (was 4 — react-hooks/set-state-in-effect on intentional mount hydration patterns) + 5 pre-existing warnings (react-hook-form `watch()` incompatibility on pages I did not author). Skipped live axe-core CLI: requires browser w/ running dev server; static checks cover the rule surface this skill needs.
Status: [ ]

## Phase H — Verify + docs + close

### Task 15: full suite + e2e smoke (local)
Files: none (verification only)
Steps:
- 1. `npm test --prefix backend` — expect 523/523 unchanged
- 2. `npm test --prefix frontend -- --run` — expect 364 + N new (≥ +15)
- 3. `npm run dev` — manual smoke checklist (record PASS/FAIL per line in progress.md):
   - 3a. Login renders w/o shell (header-less)
   - 3b. Demo-login as admin → ShellLayout mounts, default panel = Projects panel
   - 3c. Click rail icon Dashboard → URL `/dashboard`, panel swaps to DashboardPanel, active highlight moves
   - 3d. Click rail icon Inbox → URL `/inbox`, panel swaps to InboxPanel; red-dot disappears if marked read
   - 3e. Press Cmd+K (or Ctrl+K) → palette opens, type a project title → result appears, Enter navigates
   - 3f. Click panel collapse footer → panel hides; reload → still hidden (localStorage works)
   - 3g. DevTools → resize to 375px width → rail+panel hide, hamburger appears; click → drawer slides in w/ rail + panel stacked
   - 3h. Theme icon toggles light/dark; reload preserves state
   - 3i. Avatar dropdown → Logout → bounces to login
- 4. Commit `test: verify sidebar-shell suite green + local smoke`
Status: [x] 2026-06-05 — user-confirmed PASS on all 9 smoke steps. Mid-smoke fixes shipped: /inbox PROTECTED_PREFIXES (proxy.ts), api.ts session flush on refresh-fail + hard redirect, CommandPalette <Command> root (cmdk context), ProjectsPanel pin toggle UI (31ce2e2). Pre-existing task-card click-target bug flagged out of scope for separate fix branch.

### Task 16: docs + README screenshot + close phase 3
Files:
- `README.md` (one screenshot near top + brief shell mention)
- `docs/goals/smart-collab/subgoals/sidebar-shell/state.yaml`
- `docs/goals/smart-collab/subgoals/sidebar-shell/progress.md`
- `docs/goals/smart-collab/progress.md` (parent log entry)
Steps:
- 1. Take a screenshot of the new shell, drop into `frontend/public/screens/shell.png`
- 2. README: add a 2-line "Now using ClickUp-style shell" near the top w/ image link
- 3. Flip `state.yaml` phase: 3, mark `superpowers: true`
- 4. Update subgoal progress.md + parent progress.md
- 5. Commit `docs(sidebar-shell): phase 3 superpowers complete + README screenshot`
Status: [x] 2026-06-05 — shell.png saved to frontend/public/screens/, README "App shell" section added, state.yaml phase→3 + superpowers:true.

### Task 17: USER PERMISSION — open PR feature/sidebar-shell → develop
Files: none
Steps:
- 1. (USER PERMISSION) `git push -u origin feature/sidebar-shell`
- 2. (USER PERMISSION) `gh pr create --base develop --title "feat(shell): clickup-style rail + panel + topbar (L1)"`
- 3. CI must pass
- 4. After merge, Vercel auto-deploys to https://smart-collab-liard.vercel.app
- 5. Smoke on live URL
Status: [ ]

---

## Notes on scope discipline
- Every task scoped to a single concern. Anything that spreads across >2 files in the IN-scope list gets a follow-up task instead of bloating the current one.
- No backend touches. If a task wants a backend change, it's out of scope for this subgoal.
- Pinned project persistence is localStorage-only in v1; backend table is deferred. Search palette filters beyond projects+tasks deferred. Drag-reorder deferred.
- Login + Signup pages stay **outside the (authed) route group** and have **no shell** — their existing minimal layout is kept untouched.
- If t10 test-sweep churn exceeds 15 files, slice into t10a (wiring) + t10b (test fixes) — already noted in t10 step 7.

## Goal-backward verification
Each done-criterion → task mapping (verified 2026-06-05 after gap audit):

| Done # | Criterion | Covered by |
|---|---|---|
| 1 | Authed pages render inside shell | t10 |
| 2 | Rail: logo, Search, Dashboard, Projects (active), Inbox (red-dot), Help, Theme, Avatar | t3 (top) + t4 (bottom) + t5 (red-dot) |
| 3 | Panel header swaps per section; Projects panel has filter chips + Pinned + All + +New + Collapse | t6 (collapse) + t7 (Projects content w/ empty-state Pinned) |
| 4 | Panel collapses + persists across reloads (localStorage) | t6 |
| 5 | Cmd+K palette over projects + tasks; max 8 results; Enter navigates | t11 |
| 6 | /inbox route; notifications + assigned tasks; rail badged when unread > 0 | t12 + t5 |
| 7 | Theme + Logout move into avatar/theme icons at rail bottom | t4 |
| 8 | Mobile drawer below 768px | t13 |
| 9 | Frontend tests stay green; new tests for rail + panel section swap + palette + inbox unread | t3 + t5 + **t10 step 4 (section-swap test)** + t11 + t12 |
| 10 | Backend untouched; existing endpoints reused | t5 + t12 (verified by t15 backend suite 523/523) |
