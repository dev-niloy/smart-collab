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
t5 — Inbox red-dot + unread count in aria-label; reuses existing `useUnreadCount` (already shared with NotificationBell); 3 tests; frontend 381/381

## Next Task
t6 — Panel shell + collapse + localStorage persistence (`usePanelCollapsed` hook)

## Session Log
- 2026-06-05: phase 1 — brainstorming session done w/ user, locked layout B + lucide icons. goal.md drafted with done-criteria + brownfield constraints.
- 2026-06-05: phase 1 approved by user. Phase 2 GSD — docs/plans/sidebar-shell.md written, 17 tasks sliced across phases A scaffold / B rail / C panel / D topbar / E integrate / F palette+inbox / G mobile+polish / H verify+close. Branch off develop@bdda6e0.
- 2026-06-05: global GoalBuddy CLI built at ~/.claude/goalbuddy/ (gb init/status/next/verify). Plan patched w/ 6 gap fixes after goal-backward audit.
- 2026-06-05: phase 3 t1 — baseline suites confirmed green; backend 523/523, frontend 364/364. Empty commit 228912f.
- 2026-06-05: t2 — Rail/Panel/Topbar/ShellLayout scaffolded with placeholder markup + test-ids + a11y landmarks. ShellLayout.test.tsx covers slot rendering, panelCollapsed state, aside landmarks. shadcn `command` + `sheet` (and transitive `dialog`, `input-group`) installed. Frontend 367/367.
- 2026-06-05: t3 — Rail.tsx now renders workspace logo + Search button + Dashboard/Projects/Inbox links from a NAV_ITEMS table. usePathname() drives prefix-match active state (data-active true/false). Rail.test.tsx adds 6 tests covering nav rendering, active swap, nested-route prefix match, Search not a link. ShellLayout API updated: `rail` prop → `railBottom` (Rail is self-contained). dark-mode-audit caught text-white literal in logo → switched to bg-primary/text-primary-foreground theme tokens. Frontend 373/373.
- 2026-06-05: t4 — RailBottom.tsx adds Help link (external README, target=_blank+noopener), Theme button (sun/moon icon, next-themes toggle), Avatar dropdown via shadcn DropdownMenu showing email + role + Log out item. Hooks: useTheme (next-themes), useUser+useLogout (existing). RailBottom.test.tsx adds 5 tests. DropdownMenuLabel had to be wrapped in DropdownMenuGroup (base-ui group context requirement). Frontend 378/378.
- 2026-06-05: t5 — discovery: `useUnreadCount` already exists in @/hooks/useNotifications, consumed by NotificationBell. No extraction needed — already a single truth. Rail now reuses `useUnreadCount`, renders an absolute-positioned dot beside Inbox icon when count>0, and injects count into the link's aria-label. Rail.test +3 tests (zero / non-zero / undefined-data). ShellLayout.test mock updated to stub useNotifications. Frontend 381/381.

## Blockers
none

## Phase Completion
- [x] Phase 1 GStack — goal.md + progress.md written + user approved 2026-06-05
- [x] Phase 2 GSD — docs/plans/sidebar-shell.md w/ 17 tasks
- [ ] Phase 3 Superpowers — TDD execution
- [ ] Phase 4 Ralph Wiggum — multi-persona review
