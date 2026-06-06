-- Backfill: add a pm ProjectMember row for every existing project's createdBy
-- user, so legacy projects from foundation/projects-crud subgoals are
-- represented in the new membership model. Idempotent via WHERE NOT EXISTS.
INSERT INTO "project_members" (id, "projectId", "userId", role, "addedAt", "addedById")
SELECT gen_random_uuid(), p.id, p."createdBy", 'pm', p."createdAt", p."createdBy"
FROM "projects" p
WHERE NOT EXISTS (
  SELECT 1 FROM "project_members" pm
  WHERE pm."projectId" = p.id AND pm."userId" = p."createdBy"
);
