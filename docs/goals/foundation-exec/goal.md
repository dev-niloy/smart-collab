# Foundation — Smart Project & Task Collaboration System

## Objective

Stand up the monorepo foundation for the Smart Project & Task Collaboration System (EAP 4.0 Assessment): working `/backend` (Express+Prisma+TS, raw JWT/bcrypt auth, RBAC) + working `/frontend` (Next.js+TS+Tailwind+shadcn) + Postgres schema + 3-role demo seed + CI + deploy plumbing. No product-domain features (projects/tasks/dashboard) ship here — those are separate subgoals.

Authoritative scope source (hand-shaped charter): `docs/goals/smart-collab/subgoals/foundation/goal.md`. This file restates it in GoalBuddy form so the live board can drive the loop without touching the experiment files.

## Original Request

> Build the EAP 4.0 Assessment project. Next.js + React + TS + Tailwind + shadcn frontend, raw auth (showcase backend skill), Express+Prisma backend mirroring solvemeet_backend_api pattern, Vercel + Railway/Render split deploy, monorepo, per-section subgoals. First feature = foundation.

Stack + slicing locked by user across two AskUserQuestion rounds. See Intake Summary.

## Intake Summary

- Input shape: `existing_plan`
- Audience: assessment reviewer + portfolio viewer; operator `solvemeet@gmail.com`
- Authority: `approved` (Phase 1 charter signed off — `phase_completion.gstack: true` on hand-shaped board)
- Proof type: `demo` + `test`
- Completion proof: 8-point oracle (see Goal Oracle)
- Goal oracle: manual walkthrough + green suites + green CI (all three)
- Likely misfire:
  - Reaching for an auth library under pressure — forbidden
  - Polishing product features in this subgoal — out of scope
  - Pushing public deploys here — only plumbing lands
  - Marking foundation done after backend boots, before the end-to-end walkthrough holds
- Blind spots considered:
  - Access-token transport (httpOnly cookie vs Authorization header) — must be decided before auth.service.ts
  - Refresh-token rotation + revocation
  - User schema must be locked here to prevent later churn
  - CORS allowlist from env, no wildcard in non-dev
  - Demo passwords env-driven, README-documented
  - shadcn + next-themes provider lands here to avoid retrofit later
- Existing plan facts (preserved verbatim; Judge T001 validates before any Worker):
  - Hand-shaped charter at `docs/goals/smart-collab/subgoals/foundation/goal.md` = authoritative
  - Backend module pattern mirrors `solvemeet_backend_api/src/app/modules/<feature>/{constant,controller,routes,service,validation}.ts`
  - Monorepo: `/backend` + `/frontend` at repo root
  - `User` model: `id uuid, email unique, name, passwordHash, role enum [admin|project_manager|team_member], createdAt, updatedAt`
  - `Session` table: hashed refresh tokens (rotation)
  - `ActivityLog` placeholder table lands here (later subgoals don't churn migrations)
  - Demo Login: `POST /auth/demo-login` body `{ role }` returns tokens for the seeded demo user
  - Branches: `feature/foundation` off `develop`; `main` protected; explicit operator OK for push/merge
  - Hands off `docs/goals/smart-collab/**` (frozen experiment record)
  - Hands off `solvemeet_backend_api/` (pattern reference only — read, never edit)
  - Forbidden: auth libraries, AI attribution

## Goal Oracle

`Backend boots; GET /healthz returns {ok:true}. Frontend boots at :3000. Signup -> login -> /dashboard -> logout round-trips. Demo Login works for each of 3 roles. Protected route without token -> 401 (ApiError shape). Wrong-role route -> 403 (ApiError shape). 'jest' green with >=80% coverage on auth+middleware. 'vitest' green with >=70% coverage on auth pages + api lib. GitHub Actions ci.yml green on PR from feature/foundation -> develop.`

PM must compare every Worker receipt against this oracle. Booting a server is not enough. The full 8-point walkthrough must hold.

## Goal Kind

`existing_plan`

## Current Tranche

Continuous execution to full foundation completion. Tranche = the 8 oracle points — no more (no product features), no less (every point receipt-backed). Judge T001 validates the preserved plan; then Worker packages execute vertical slices (bootstrap → prisma schema+seed → auth module → middlewares → frontend init → frontend auth pages → CI/deploy plumbing). Final audit (T999) maps receipts back to the oracle.

## Non-Negotiable Constraints

- **Raw auth only.** No better-auth, NextAuth, Clerk, Auth.js, Lucia, Iron Session. Bcrypt + jsonwebtoken + Prisma only.
- **User model frozen.** Fields exactly as listed. Later subgoals add new tables/columns only.
- **Refresh tokens hashed at rest.** Never plaintext.
- **Server-side validation is the gate.** Client validation mirrors but never trusts.
- **CORS allowlist from env.** No wildcard in non-dev.
- **Demo passwords from env**, README-documented, never committed in seed.ts.
- **Git rules per `~/.claude/CLAUDE.md`:** no AI attribution anywhere; commits human-style (`<type>: <desc>`); `feature/foundation` off `develop`; `main` protected; **explicit operator OK required before any `git push`, `git merge`, `git rebase`, PR open, force push, remote add, or tag** — silence is not consent.
- **Hands off `docs/goals/smart-collab/**`** (frozen experiment).
- **Hands off `solvemeet_backend_api/`** (pattern reference only).
- **No public deploy push.** Dockerfile + vercel.ts stub + ci.yml only.
- **No product features in this subgoal.**

## Stop Rule

Stop only when T999 final audit proves the 8-point oracle holds end-to-end with receipts to back every point. Do not stop after backend boots. Do not stop after Prisma migrates. The oracle is the walkthrough, the suites, and the CI — all three.

If a slice needs operator input (credentials, hosting choice, git push approval), mark that slice blocked with a receipt and continue with adjacent safe local work.

## Slice Sizing

Worker packages vertical and useful. Prefer one Worker per stack layer judged as a whole. Tiny tasks allowed only for: access-token-transport PM decision, CORS allowlist env wiring, or a blocker spawn.

## Canonical Board

Machine truth: `docs/goals/foundation-exec/state.yaml`. If this charter and `state.yaml` disagree, `state.yaml` wins.

## Run Command

```text
/goal Follow docs/goals/foundation-exec/goal.md.
```

## PM Loop

1. Read this charter.
2. Read `state.yaml`.
3. Run the GoalBuddy update checker; mention newer version without blocking.
4. Re-check intake (input_shape=existing_plan, authority=approved, proof=demo+test).
5. Work only on the active task.
6. Assign Scout / Judge / Worker / PM per the card.
7. Write a compact receipt against the oracle, not "feels done."
8. Update `state.yaml` (single source of truth).
9. Continue to the next largest safe vertical slice unless blocked or at a phase boundary.
10. If a follow-up should become a repo artifact, ask operator before creating.
11. Review at phase / risk / rejected-verification / ambiguity / final-audit boundaries.
12. Finish only when T999 receipt says `full_outcome_complete: true` AND every oracle point has a corresponding receipt.

External artifacts are supporting. `state.yaml` is authoritative. Push/PR/merge always requires explicit operator OK.
