/*
  Warnings:

  - Added the required column `entityId` to the `activity_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `activity_logs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "entityId" UUID NOT NULL,
ADD COLUMN     "entityType" TEXT NOT NULL,
ADD COLUMN     "projectId" UUID;

-- CreateIndex
CREATE INDEX "activity_logs_projectId_createdAt_idx" ON "activity_logs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_createdAt_idx" ON "activity_logs"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "tasks_projectId_title_unique" RENAME TO "tasks_projectId_title_key";
