-- Multi-assignee cutover complete. Drop legacy single-FK Task.assignedTo.
-- TaskAssignee join is the canonical source of assignment (backfilled in
-- 20260606025915_add_task_assignee).

DROP INDEX IF EXISTS "tasks_assignedTo_idx";
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_assignedTo_fkey";
ALTER TABLE "tasks" DROP COLUMN "assignedTo";
