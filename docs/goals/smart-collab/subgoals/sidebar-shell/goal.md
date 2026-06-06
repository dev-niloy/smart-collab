# Goal — sidebar-shell (subgoal)

Parent: `smart-collab`
Branch: `feature/sidebar-shell` off `develop@bdda6e0`
Mode: brownfield · feature · new session

---

## What
Replace the current top `<Header />` bar with a ClickUp-style two-column sidebar shell:
- **Rail (48–52px)** — workspace logo, primary nav icons (Search, Dashboard, Projects, Inbox), bottom icons (Help, Theme, Avatar)
- **Panel (260px, collapsible)** — section-aware secondary navigation (e.g., Projects panel shows pinned + all project list with filter chips; Dashboard / Inbox panels show their own contents)
- **Topbar (48px)** — breadcrumbs + per-page action area
- **Main** — existing page content, unchanged

This is L1 of a phased ClickUp clone roadmap. Spaces tree, list views, docs, goals, custom fields all explicitly OUT for this subgoal.

## Why
Current top-only nav doesn't scale beyond Dashboard / Projects. The redesign:
- Surfaces section-aware nav (each main route gets its own panel content)
- Unlocks future ClickUp-style features (Inbox, Search palette, Spaces) without further chrome refactor
- Matches a reference UI the user explicitly approved (ClickUp screenshot + custom mockup v2)

## Done looks like
1. Every authenticated page renders inside the rail+panel+topbar shell (no orphan pages using old `<Header />`)
2. Rail shows: workspace logo, Search (opens Cmd+K palette), Dashboard, Projects (active highlight), Inbox (red-dot when unread), then Help, Theme, Avatar
3. Panel header swaps per active section. For Projects: header "Projects" + filter chips (All/Active/Mine/Archived), Pinned group, All projects list, "+ New" button, "Collapse panel" footer
4. Panel collapses to icon-only on a click; persists state across reloads (localStorage)
5. Cmd+K (or Ctrl+K) opens a global search palette: at minimum, fuzzy across project + task titles, max 8 results, Enter navigates
6. Inbox page (new `/inbox` route) lists current user's notifications and tasks assigned to them (badged on rail when unread > 0)
7. Theme toggle and Logout move into avatar menu / theme icon at rail bottom
8. Mobile (<768px): rail collapses into a top hamburger that opens an off-canvas drawer with rail + panel stacked
9. Frontend test suite stays green and grows for new components; minimum: rail rendering, panel section swap, palette open/close + result selection, inbox unread count
10. Backend untouched (favorites or spaces NOT added) — Inbox uses existing notification + assigned-tasks endpoints

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Locked decisions
- Shell layout: rail (52px) + panel (260px, collapsible to 0) + topbar (48px) + main
- Icon style: lucide-react outline, 20px, stroke-width 1.75 (already in repo via shadcn)
- Active section indicator: 2px left accent + tinted background on rail item
- Panel collapse persisted to localStorage key `sc:panel:collapsed`
- Cmd+K palette: client-side, uses existing `/api/v1/projects` + `/api/v1/tasks` list endpoints with a `q` debounce; no new backend
- Inbox content: existing notifications endpoint + tasks endpoint filtered by `assignedTo=me`
- Mobile breakpoint: 768px (matches Tailwind `md`)
- Single dark theme used in mockups; sidebar uses existing CSS variables so it follows the active theme automatically

## Constraints (brownfield)
- MUST NOT change any backend route, schema, response shape, or test count (currently 523)
- MUST NOT delete or rename any existing page route — only the chrome around them
- MUST preserve all current frontend tests (364 baseline); new tests add on top
- MUST keep deploy-prod live URLs working through the entire change set (no behavior regression on `https://smart-collab-liard.vercel.app`)
- MUST work without a Vercel rebuild loop (changes localized to `frontend/`)
- MUST keep the existing `NotificationBell` semantics, even if its position moves into rail/inbox
- MUST NOT introduce new top-level packages — use what's installed (lucide-react, shadcn primitives, Tailwind)

## Scope
- IN: `frontend/src/components/shell/` (new Rail, Panel, ShellLayout, Topbar components); refactor `frontend/src/app/(authed)/layout.tsx` (or equivalent) to wrap children in shell; replace `<Header />` usage; add `frontend/src/app/inbox/page.tsx`; add Cmd+K palette component; add localStorage hook for panel collapse; update tests; update one screenshot in README
- OUT: backend changes; Spaces / Folders / Lists hierarchy; multi-view (Board/List/Calendar); Docs editor; Goals; custom fields; drag-reorder; favorites pinning persisted backend-side (panel "Pinned" group reads from a hard-coded helper for v1 OR from a localStorage list — no DB)
- DEFERRED: pinning persistence, multi-workspace, keyboard shortcut help modal (Help icon can open existing docs link for now)

## Existing Tests
- Backend jest: 523 (no changes expected)
- Frontend vitest: 364 baseline; expected delta +6 to +12 for new shell components
- Coverage: `npm test -- --coverage` (frontend), `npm test` (backend)

## Acceptance Criteria
Items 1–10 above. Smoke on https://smart-collab-liard.vercel.app after deploy: open in incognito → demo-login as any role → see new shell → click each rail icon → confirm panel swaps → press Cmd+K → confirm palette opens and searches → resize to mobile → confirm drawer.
