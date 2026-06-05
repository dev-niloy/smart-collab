# Plan — sidebar-v2 (Phase 2 GSD)

Parent SPEC: `docs/goals/smart-collab/subgoals/sidebar-v2/goal.md`
Branch: `feature/sidebar-v2` off `develop@f66149f`
Mode: brownfield · feature · new session

Each task ends with a commit. RED → GREEN → REFACTOR → suite green → commit.
Internal steps stay <5 min; tasks bigger than that auto-slice during execution.

---

## Phase A — <name>

### Task 1: baseline verification commit
Files: none
Steps:
- 1. Run full suites — record counts
- 2. Empty commit `chore: baseline before sidebar-v2 work begins`
Status: [ ]

### Task 2: <short imperative>
Files:
- path/one
- path/two (NEW)
Steps:
- 1. RED: <failing test description>
- 2. GREEN: <minimal impl>
- 3. REFACTOR: <cleanup>
- 4. Commit `<type>(<scope>): <subject>`
Status: [ ]

---

## Notes on scope discipline
- One concern per task. >2 files = slice into follow-up tasks.
- Brownfield: every task must preserve goal.md Constraints.
- Defer anything that creeps in mid-execution; record in `state.yaml.blockers` or open a follow-up subgoal.

## Goal-backward verification

| Done # | Criterion | Covered by |
|---|---|---|
| 1 | <criterion> | t<N> |
