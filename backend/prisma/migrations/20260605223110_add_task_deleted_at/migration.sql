-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tasks_projectId_deletedAt_idx" ON "tasks"("projectId", "deletedAt");
