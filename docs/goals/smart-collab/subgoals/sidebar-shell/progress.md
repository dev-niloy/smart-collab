# Progress — sidebar-shell

## Project
- Subgoal: sidebar-shell
- Started: 2026-06-05
- Last updated: 2026-06-05

## Current Phase
Phase 3 Superpowers — t1 baseline done; next t2 (shell scaffolding + shadcn pre-flight)

## Locked decisions
- Layout: rail 52 + panel 260 (collapsible) + topbar 48 + main
- Reference: ClickUp shell (user-provided screenshot) + custom v2 mockup
- Icons: lucide-react (already installed via shadcn)
- No backend changes
- Panel collapse state in localStorage
- Cmd+K palette uses existing list endpoints
- Inbox page is new (`/inbox`); reuses notifications + assigned-tasks
- Mobile: drawer below 768px

## Brainstorm artifacts
- Visual companion session: `.superpowers/brainstorm/234748-1780643910/content/`
  - `shell-anatomy.html` — picked option B (rail + collapsible panel)
  - `full-shell-mockup.html` — first pass rejected (emoji icons)
  - `shell-v2-icons.html` — locked direction (lucide outline)

## Last Completed Task
t11 — CommandPalette w/ shadcn CommandDialog, global Cmd+K toggle, 200ms debounced query over /projects?q + /tasks?q, capped at 8 each, wired into (authed)/layout via Rail.onSearchClick; 7 tests; frontend 402/402

## Next Task
t12 — /inbox route page (notifications + assigned tasks)

## Session Log
- 2026-06-05: phase 1 — brainstorming session done w/ user, locked layout B + lucide icons. goal.md drafted with done-criteria + brownfield constraints.
- 2026-06-05: phase 1 approved by user. Phase 2 GSD — docs/plans/sidebar-shell.md written, 17 tasks sliced across phases A scaffold / B rail / C panel / D topbar / E integrate / F palette+inbox / G mobile+polish / H verify+close. Branch off develop@bdda6e0.
- 2026-06-05: global GoalBuddy CLI built at ~/.claude/goalbuddy/ (gb init/status/next/verify). Plan patched w/ 6 gap fixes after goal-backward audit.
- 2026-06-05: phase 3 t1 — baseline suites confirmed green; backend 523/523, frontend 364/364. Empty commit 228912f.
- 2026-06-05: t2 — Rail/Panel/Topbar/ShellLayout scaffolded with placeholder markup + test-ids + a11y landmarks. ShellLayout.test.tsx covers slot rendering, panelCollapsed state, aside landmarks. shadcn `command` + `sheet` (and transitive `dialog`, `input-group`) installed. Frontend 367/367.
- 2026-06-05: t3 — Rail.tsx now renders workspace logo + Search button + Dashboard/Projects/Inbox links from a NAV_ITEMS table. usePathname() drives prefix-match active state (data-active true/false). Rail.test.tsx adds 6 tests covering nav rendering, active swap, nested-route prefix match, Search not a link. ShellLayout API updated: `rail` prop → `railBottom` (Rail is self-contained). dark-mode-audit caught text-white literal in logo → switched to bg-primary/text-primary-foreground theme tokens. Frontend 373/373.
- 2026-06-05: t4 — RailBottom.tsx adds Help link (external README, target=_blank+noopener), Theme button (sun/moon icon, next-themes toggle), Avatar dropdown via shadcn DropdownMenu showing email + role + Log out item. Hooks: useTheme (next-themes), useUser+useLogout (existing). RailBottom.test.tsx adds 5 tests. DropdownMenuLabel had to be wrapped in DropdownMenuGroup (base-ui group context requirement). Frontend 378/378.
- 2026-06-05: t5 — discovery: `useUnreadCount` already exists in @/hooks/useNotifications, consumed by NotificationBell. No extraction needed — already a single truth. Rail now reuses `useUnreadCount`, renders an absolute-positioned dot beside Inbox icon when count>0, and injects count into the link's aria-label. Rail.test +3 tests (zero / non-zero / undefined-data). ShellLayout.test mock updated to stub useNotifications. Frontend 381/381.
- 2026-06-05: t6 — usePanelCollapsed hook (collapsed/setCollapsed/toggle) returns SSR-safe state, hydrates from localStorage key `sc:panel:collapsed` on mount, persists on every change, ignores garbage values. Hook test 6 cases (default / hydrate true / hydrate false / setCollapsed / toggle / garbage). Panel.test.tsx 2 cases (renders w/ name + children, collapsed → w-0 + children hidden). Frontend 389/389.
- 2026-06-05: t7 — ProjectsPanel.tsx reuses `useProjects` hook; chips are local state (no URL sync in v1 — simpler, can lift to URL in a follow-up). 4 chips: All / Active / Mine (createdBy=me) / Completed. Deviation noted: plan called for "Archived" chip; backend has no archive status, so Completed substitutes. Pinned section reads `sc:projects:pinned` (JSON string array) from localStorage; shows "No pinned projects yet" placeholder when empty; garbage values ignored. ProjectsPanel.test.tsx 7 tests. Frontend 396/396.
- 2026-06-05: t8 — DashboardPanel.tsx renders header + 2 lucide-icon shortcuts (`My Open Tasks` → /dashboard#my-open-tasks, `Today's Deadlines` → /dashboard#upcoming-deadlines). InboxPanel.tsx renders header + 3 vertical tabs (Unread default / Mentions / Assigned to me) using local state + optional `onTabChange` callback for later wiring from the /inbox page (t12). 5 new tests. Frontend 401/401.
- 2026-06-05: t9 — Topbar `segments` prop now accepts `string | { label, href? }[]`. Intermediate segments with `href` render as next/link; the last segment is always plain text (current-location convention). Actions slot rendered in `ml-auto` container on the right. Topbar.test.tsx 5 cases. Frontend 406/406.
- 2026-06-05: t10 — High-risk Header sweep. Pre-flight grep: 10 page files + 1 component (DashboardGrid) used `<Header />`; 16 page tests, none asserting on Header DOM (no test sweep needed). git mv dashboard/projects/forbidden into src/app/(authed)/ route group. Added `src/app/(authed)/layout.tsx` mounting ShellLayout + RailBottom + dynamically picked panel via `routeToPanel.ts` helper (`getPanelKey` + `pickPanel`). Section-swap test covers goal #9 with 5 cases (null, root, prefix-match, nested, unknown). Stripped `<Header />` import + JSX from 10 pages + DashboardGrid via sed. Deleted orphan files: header.tsx, theme-toggle.tsx, notifications/NotificationBell.tsx, search/GlobalSearchBar.tsx + 3 tests + 2 now-empty dirs. providers.test trimmed (lost the ThemeToggle assertion). Frontend 395/395 (net delta: −16 deleted assertions + 5 new routeToPanel tests). `next build` green; all routes still resolve to same URLs. Under 15-file threshold — no auto-slice.
- 2026-06-05: t11 — CommandPalette.tsx wraps shadcn `CommandDialog`. Global window keydown listens for Cmd+K / Ctrl+K to toggle open. Query state is debounced 200ms; both `useProjects` + `useTasks` hooks are gated on `hasQuery` so blank-open does NOT fire the network. Results capped at 8 each in two `CommandGroup`s (Projects, Tasks); selecting an item routes via `next/navigation` `router.push`. Empty / loading / no-match states are explicit. Wired into (authed)/layout.tsx via local state + `onSearchClick` plumbed through ShellLayout → Rail. Tests: mocked `@/components/ui/command` surface (cmdk needs jsdom shims that aren't worth setting up for this skill) and asserted on the wiring directly; 7 cases (Cmd+K open / blank-open no-fetch / debounce / capped lists / project route / task route / no-match state). Frontend 402/402.

## Blockers
none

## Phase Completion
- [x] Phase 1 GStack — goal.md + progress.md written + user approved 2026-06-05
- [x] Phase 2 GSD — docs/plans/sidebar-shell.md w/ 17 tasks
- [ ] Phase 3 Superpowers — TDD execution
- [ ] Phase 4 Ralph Wiggum — multi-persona review
