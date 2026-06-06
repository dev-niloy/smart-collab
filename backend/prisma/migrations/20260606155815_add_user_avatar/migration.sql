-- Add User.avatarPath column for profile picture storage path.
-- Nullable; existing rows keep null until the user uploads.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarPath" TEXT;
