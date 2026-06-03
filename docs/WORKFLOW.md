# Workflow — GoalBuddy-Hybrid Tracker (project-scoped)

This project replaces the flat `docs/progress.md` tracker from the global
autonomous-loop with a **GoalBuddy-hybrid board**. Everything else in the
4-phase loop (GStack → GSD → Superpowers → Ralph Wiggum) stays the same.

> Scope: applies to THIS project only. Global `~/.claude/autonomous-loop.md`
> is unchanged. If this proves out, promote it to global later.

---

## The split — who owns what

Two files per feature, one job each. No double-tracking.

| File | Owner of | Read by | Format |
|------|----------|---------|--------|
| `state.yaml` | machine state: phase, task board, receipts, blockers, next task | agents (resume, pre-flight, verify gates) | structured YAML |
| `progress.md` | human narrative: session log, decisions, the "why" | humans (handoff skim) | thin prose, append-only |
| `goal.md` | what we want + why | both | prose |

**Rule:** task status lives ONLY in `state.yaml`. There is no `docs/plans/*.md`
Status field in this project — the board is `state.yaml`. Single source of truth.

---

## Directory layout

```
docs/goals/<feature-name>/
  goal.md          # what + why (the charter)
  state.yaml       # the board — machine source of truth
  progress.md      # thin human session log
  notes/           # long findings kept out of the main thread
  subgoals/        # optional child boards when one task explodes
```

Copy `docs/goals/_TEMPLATE/` to start a new feature.

---

## state.yaml schema

```yaml
feature: <kebab-name>            # required
created: YYYY-MM-DD              # set once
updated: YYYY-MM-DD              # bump every session

mode:
  type: greenfield | brownfield
  scope: full-project | feature
  session: new | resume

phase: 1 | 2 | 3 | 4 | DONE      # current phase

tasks:
  - id: t1                        # stable, never reused
    desc: <short task description>
    files: [path/a, path/b]       # new or changed
    status: todo | active | done | blocked
    receipt: null                 # PROOF when done — not a claim. see below

blockers: []                      # list of {ref, desc} — pre-flight reads this

next_task: t2                     # id of next todo/active task, or null

phase_completion:
  gstack: false                   # Phase 1 SPEC written
  gsd: false                      # Phase 2 board fully sliced
  superpowers: false              # Phase 3 all tasks done, suite green
  ralph_wiggum: false             # Phase 4 [DONE]
```

### Receipts — the real upgrade
A task is NOT `done` until `receipt` holds **evidence**, not a claim.

```yaml
# ✅ real receipt — proof you can re-check
receipt: "pytest: 142 passed, cov 87% (baseline 85%)"
receipt: "manual: login→dashboard flow ok, screenshot notes/t4-login.png"

# ❌ not a receipt — a claim
receipt: "done"
receipt: "implemented the feature"
```

If a task is `done` with `receipt: null` or a vibe-claim → treat as NOT done.
This is what catches "done but unverified" lies that flat progress.md missed.

### blockers
```yaml
blockers:
  - ref: t3
    desc: "[BLOCKED] DB migration needs prod schema access"
```
Phase 4 Ralph Wiggum pre-flight reads `blockers` directly — clean, no grep.

### subgoals
When one task is too big to slice in place, branch it:
```yaml
tasks:
  - id: t5
    desc: build notification system
    status: blocked
    receipt: null
    subgoal: docs/goals/<feature>/subgoals/notifications/
```
Child board has its own `state.yaml`. Parent task done only when child = DONE.

---

## How each phase reads/writes the board

**Resume (start of any session)** — read `state.yaml` first:
- `phase` → which phase we're in
- `next_task` → exact resume point
- `blockers` → any unresolved (stop if so)
- skim `progress.md` for the human "why"

**Phase 3 per-task loop** — after RED/GREEN/REFACTOR/commit:
1. set task `status: done`
2. write real `receipt` (test output / walkthrough — proof)
3. set `next_task` to next todo id
4. bump `updated`
5. append one line to `progress.md` session log

**Phase 4 Ralph Wiggum** — `[DONE]` requires:
- all tasks `status: done` with non-null real receipts
- `blockers: []`
- then set `phase: DONE`, all `phase_completion: true`

---

## Known risk being tested
YAML is more fragile to agent edits than markdown checkboxes (indentation).
If agents corrupt `state.yaml` repeatedly → fall back: markdown board + keep
only the `receipt` idea. Watching this on the first feature.
