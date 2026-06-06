# Goal — progress-system (subgoal)

Parent: `smart-collab`
Branch: `feature/progress-system` off `develop@25fb539`
Mode: brownfield · feature · new session

---

## What
Add a project-level progress signal driven by task completion. Backend computes `{done, total, percent}` per project and returns it on the project list + detail endpoints. Frontend surfaces it as a thin bar on project cards, a large bar on the project detail header, a thin bar under each sidebar Pinned project, and an aggregate "My open tasks" bar in the Dashboard widget.

## Why
Users currently have no glance-level signal for project completion. Status (active / on_hold / completed) is binary and doesn't show momentum. % done is the industry-standard PM signal (Linear, Jira, Asana all default to it) and unlocks "show me what's stuck" + "show me what's almost shipped" without opening every project.

## Done looks like
1. `GET /api/projects` returns `progress: { done, total, percent }` on each project. `percent` rounded to int 0–100. Empty project (`total=0`) returns `percent=0` (no NaN).
2. `GET /api/projects/:id` returns the same `progress` field.
3. `/projects` list cards render a `<ProgressBar percent={...} />` w/ label "{done}/{total} · {percent}%". Aria-label "Project progress {percent} percent". 0/0 shows "0 tasks".
4. `/projects/[id]` detail header renders a larger ProgressBar (full-width) above the deadline/status grid.
5. Sidebar `ProjectsPanel` Pinned rows render a 2px-tall progress bar under the project name (hidden when total=0).
6. Dashboard "My open tasks" widget renders aggregate % done across the user's assigned tasks (sum of done / sum of total across all projects user has tasks in).
7. Mutating a task's status (todo/in_progress/done) invalidates the relevant `projects` queries on the frontend so percent re-renders w/o a refresh.

## Mode
- project_type: brownfield
- scope: feature
- session: new

## Locked decisions
- **Weighting**: binary — `done` only counts as 1, everything else as 0. Industry standard (Linear/Jira/Asana default). `percent = round(done / total * 100)`. Total includes todo + in_progress + done.
- **Surfaces**: 4 — project list cards, project detail header, sidebar Pinned rows, Dashboard "My open tasks" widget.
- **Compute**: server-side aggregate folded into existing project list + detail responses. Single round trip per page, no per-project N+1.
- **Caching**: react-query invalidation on task mutations targets `['projects']` + `['project', id]` keys; backend computes on every read (no DB cache layer in v1).
- **Component**: one shared `<ProgressBar percent={number} />` primitive in `frontend/src/components/ui/progress.tsx` (shadcn `progress`). Wrap w/ project-shaped helpers (`<ProjectProgress project={p} variant="card|detail|inline" />`) in `frontend/src/components/projects/`.
- **Backend shape**: `progress: { done: number; total: number; percent: number }` on `Project` DTO; Zod schema updated; OpenAPI contract updated if generated.

## Constraints (brownfield)
- MUST NOT change `Project` DB schema (no migration).
- MUST NOT break existing `Project` DTO shape — `progress` is an additive field; existing tests asserting on `{id, name, status, ...}` must still pass.
- MUST NOT add per-project N+1 queries — compute via single SQL aggregate (`COUNT(*) FILTER (WHERE status='done')` + `COUNT(*)` per project, joined on the list query).
- MUST preserve the `useProjects` hook signature; consumers of the existing query receive the augmented Project with no signature change.
- MUST preserve existing 523 backend tests and 427 frontend tests as a non-regressing baseline.
- MUST NOT touch unrelated phases (no sidebar-v2 work, no profile-settings work).

## Scope
- IN:
  - Backend: project service aggregates `done` + `total` from `tasks` table joined on `projectId`, includes in list + detail response.
  - Backend: Zod / response schema updated; Project DTO type augmented.
  - Frontend: shared `ProgressBar` primitive + `ProjectProgress` helper.
  - Frontend: 4 surfaces wired (list card, detail header, sidebar Pinned row, Dashboard widget).
  - Frontend: query invalidation on task mutations so % re-renders.
  - Tests: backend service + controller test for aggregate shape, edge cases (empty project, all-done project, project w/ only in_progress). Frontend component + integration tests on each surface.
- OUT:
  - Per-user progress filters (e.g. "my % done in this project").
  - Burndown / time series of % over time.
  - Sparkline / weekly delta.
  - Notifications when project crosses thresholds.
  - Velocity tracking.
  - Caching layer (Redis, materialized view) — read-time aggregate is fine at this scale.
- DEFERRED:
  - Three-state weighting (in_progress=0.5) — can swap formula if users complain.
  - Subtask-aware weighting — no subtasks in schema yet.

## Existing Tests
- Backend: Jest — 523 baseline (must remain green; new tests add to this count)
- Frontend: Vitest — 427 baseline (must remain green; new tests add to this count)
- Coverage command (backend): `cd backend && npm test -- --coverage --silent`
- Coverage command (frontend): `cd frontend && npm test -- --coverage --run`

## Acceptance Criteria
Items 1–7 above. Verified by:
- Backend Jest assertions on the project list + detail responses against seeded fixtures (empty, partial, fully-done).
- Frontend Vitest assertions on each of the 4 surfaces rendering the bar w/ correct percent + label.
- Manual smoke: create project → 3 tasks (1 done, 1 in_progress, 1 todo) → list shows 33%, detail shows 33%, pin → sidebar shows 33% bar, mark in_progress → done → all surfaces flip to 67% w/o page refresh.
