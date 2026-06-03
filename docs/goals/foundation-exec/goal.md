# Foundation — Smart Project & Task Collaboration System

## Objective

Stand up the monorepo foundation for the Smart Project & Task Collaboration System (EAP 4.0 Assessment): working `/backend` (Express+Prisma+TS, raw JWT/bcrypt auth, RBAC) + working `/frontend` (Next.js+TS+Tailwind+shadcn) + Postgres schema + 3-role demo seed + CI + deploy plumbing. No product-domain features (projects/tasks/dashboard) ship here — those are separate subgoals.

This is the execution mirror of the hand-shaped charter at:
`docs/goals/smart-collab/subgoals/foundation/goal.md`

That hand-shaped charter is the authoritative scope source. This file restates it in GoalBuddy form so the live board can drive the loop without touching the experiment files.

## Original Request

> "i want to build this project [EAP 4.0 Assessment Task .md] — Next.js + React + TS + Tailwind + shadcn frontend, raw auth for backend (showcase backend skill), Express+Prisma backend mirroring solvemeet_backend_api pattern, Vercel + Railway/Render split deploy, monorepo, per-section subgoals, first feature = foundation"

Stack + slicing already locked by user across two AskUserQuestion rounds. See Intake Summary.

## Intake Summary

- Input shape: `existing_plan`
- Audience: assessment reviewer + portfolio viewer; user (solvemeet@gmail.com) as primary operator
- Authority: `approved` (stack + scope locked; Phase 1 charter signed off by user with `phase_completion.gstack: true`)
- Proof type: `demo` + `test` (manual walkthrough is primary, test suites + CI back it)
- Completion proof: see Goal Oracle below — all 8 "Done looks like" criteria from the hand-shaped charter
- Goal oracle: manual walkthrough (signup→login→dashboard→logout + Demo Login for each role + 401/403 negative paths) + green test suites with coverage targets + green CI on `feature/foundation` → `develop` PR
- Likely misfire:
  - Reaching for an auth library (better-auth / NextAuth / Clerk) under pressure — **forbidden**; raw only
  - Polishing dashboard / projects / tasks in this subgoal — out of scope, belongs to later subgoals
  - Pushing public deploys here — only the plumbing lands; actual URLs are in the `deploy-and-readme` subgoal
  - Marking foundation done after Worker boots without proving the end-to-end demo walkthrough
- Blind spots considered:
  - Access token transport (httpOnly cookie vs Authorization header) — recorded as a PM decision task before auth.service.ts ships
  - Session model design for refresh-token rotation (hashed rows, revocation strategy)
  - `User` schema is **frozen** here — later subgoals must add, not alter
  - CORS allowlist must come from env (no wildcard outside dev)
  - Demo passwords must be env-driven, README-documented; never committed
- Existing plan facts (preserved verbatim; Judge must validate before Worker queue):
  - Monorepo at repo root: `/backend`, `/frontend`
  - Backend module pattern mirrors `solvemeet_backend_api/src/app/modules/<feature>/{constant,controller,routes,service,validation}.ts`
  - Backend deps: Express, Prisma, PostgreSQL, bcrypt, jsonwebtoken, Zod, Jest, pino|winston, helmet, cors, morgan
  - Frontend deps: Next.js App Router, TS, Tailwind, shadcn/ui, TanStack Query, RHF+Zod, next-themes, Vitest+RTL
  - `User` model locked: `id uuid, email unique, name, passwordHash, role enum [admin|project_manager|team_member], createdAt, updatedAt`
  - `Session` table for hashed refresh tokens (rotation)
  - `ActivityLog` placeholder table lands in this subgoal so later subgoals don't churn migrations
  - Demo Login: POST `/auth/demo-login` body `{ role }` → returns tokens for the seeded demo user of that role
  - Branches: `feature/foundation` off `develop`; `main` protected; explicit user OK required for push/merge per `~/.claude/CLAUDE.md`
  - **Hands off:** `docs/goals/smart-collab/**` is frozen experiment record — do not edit
  - **Forbidden:** any auth library; AI attribution in commits/branches/PRs/comments

## Goal Oracle

`Backend boots → GET /healthz returns {ok:true}. Frontend boots at :3000. Signup → login → /dashboard → logout round-trips. Demo Login button works for each of the 3 roles. Protected backend route without token → 401 (ApiError shape). Wrong-role route → 403 (ApiError shape). 'jest' (backend) green with ≥80% coverage on auth+middleware. 'vitest' (frontend) green with ≥70% coverage on auth pages + api lib. GitHub Actions ci.yml green on PR from feature/foundation → develop.`

PM must compare every Worker receipt against this oracle. Booting a server is not enough. Passing one test is not enough. The full 8-point walkthrough must hold.

## Goal Kind

`existing_plan`

## Current Tranche

Continuous execution to full foundation completion. The tranche is exactly the 8 "Done looks like" criteria from the hand-shaped charter — no more (no projects/tasks/dashboard), no less (every criterion must be receipt-backed). Judge T001 validates the preserved plan first; then Worker packages execute vertical slices (monorepo init → prisma schema+seed → auth module → middlewares → frontend init → frontend auth pages → CI/deploy plumbing). Final audit (T999) maps receipts back to the oracle.

## Non-Negotiable Constraints

- **Raw auth only.** No better-auth, NextAuth, Clerk, Auth.js, Lucia, Iron Session, or any other auth library. Bcrypt + jsonwebtoken + Prisma only.
- **User model frozen.** Fields exactly as listed in Intake. Later subgoals add new tables/columns only.
- **Refresh tokens hashed at rest.** Never plaintext.
- **Server-side validation is the gate.** Client validation mirrors but never trusts.
- **CORS allowlist from env.** No wildcard in non-dev.
- **Demo passwords from env**, README-documented, never committed in seed.ts.
- **Git rules per `~/.claude/CLAUDE.md`:** no AI attribution anywhere (commits, branches, PRs, comments, file names); commits human-style (`<type>: <desc>`); `feature/foundation` off `develop`; `main` protected; **explicit operator OK required before any `git push`, `git merge`, `git rebase`, PR open, force push, remote add, or tag** — silence is not consent.
- **Hands off `docs/goals/smart-collab/**`.** Hybrid-tracker experiment files stay frozen as a parallel record.
- **Hands off `solvemeet_backend_api/`.** Pattern reference only — read, never edit.
- **No public deploy push in this subgoal.** Dockerfile + vercel.ts stub + ci.yml only; real URLs are in `deploy-and-readme`.
- **No product features in this subgoal.** Projects, tasks, members, dashboard, search, activity content, files, comments, notifications all belong to later subgoals.

## Stop Rule

Stop only when T999 final audit proves the 8-point oracle holds end-to-end with receipts to back every point.

Do not stop after backend boots. Do not stop after Prisma migrates. Do not stop after auth routes return 200. Do not stop after frontend renders Login. The oracle is the walkthrough, the suites, and the CI — all three.

If a slice needs operator input (e.g. confirming token transport, providing demo passwords, approving git push, choosing Railway vs Render), mark that exact slice blocked with a receipt and continue with adjacent safe local work.

## Slice Sizing

Worker packages should be vertical and useful:
- "auth module end-to-end with tests" beats "constant file → controller file → service file → routes file" repeated four times
- "frontend auth pages with smoke tests" beats "install shadcn → init Tailwind → write Button wrapper"
- Prefer one Worker package per layer of the stack, judged as a whole

Tiny tasks allowed only for: the access-token-transport PM decision, the CORS allowlist env wiring (security-sensitive), or a blocker spawn.

## Canonical Board

Machine truth lives at:

`docs/goals/foundation-exec/state.yaml`

If this charter and `state.yaml` disagree, `state.yaml` wins for task status, active task, receipts, verification freshness, and completion truth.

## Run Command

```text
/goal Follow docs/goals/foundation-exec/goal.md.
```

## PM Loop

On every `/goal` continuation:

1. Read this charter.
2. Read `state.yaml`.
3. Run the bundled GoalBuddy update checker when available; mention a newer version without blocking.
4. Re-check intake (input_shape=existing_plan, authority=approved, proof=demo+test).
5. Work only on the active task.
6. Assign Scout / Judge / Worker / PM per the task card.
7. Write a compact receipt against the oracle, not against "task feels done."
8. Update the board (single source of truth = `state.yaml`).
9. Continue to the next largest safe vertical slice unless blocked or at a phase boundary.
10. If a problem, suggestion, or follow-up should become a repo artifact, ask the operator before creating it.
11. Review at phase / risk / rejected-verification / ambiguity / final-audit boundaries — not after every Worker by habit.
12. Finish only when T999 receipt says `full_outcome_complete: true` AND every oracle point has a corresponding receipt.

External artifacts (issues, PRs) are supporting. `state.yaml` remains authoritative. Git push / PR open / merge always requires explicit operator OK per the constraint above.
