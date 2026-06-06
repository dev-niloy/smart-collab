-- CreateIndex
CREATE UNIQUE INDEX "tasks_projectId_title_unique" ON "tasks"("projectId", "title");
