import type { Prisma, Comment } from '@prisma/client';
import { Role } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { recordActivity } from '../activityLog/activityLog.service';
import { decodeCursor, encodeCursor } from '../activityLog/activityLog.validation';
import { enqueueMany as enqueueNotifications } from '../notification/notification.service';
import { parseMentions, MAX_MENTIONS_PER_COMMENT } from './comment.mentions';

export type CommentDTO = {
  id: string;
  taskId: string;
  body: string;
  author: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
};

export type CommentListPage = {
  items: CommentDTO[];
  nextCursor: string | null;
};

export type SystemRole = Role;
export type ProjectRoleOrAdmin = 'admin' | 'pm' | 'member';

type CommentWithAuthor = Comment & { author: { id: string; name: string } };

const toDTO = (row: CommentWithAuthor): CommentDTO => ({
  id: row.id,
  taskId: row.taskId,
  body: row.body,
  author: { id: row.author.id, name: row.author.name },
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ensureTaskExists = async (
  taskId: string,
): Promise<{
  projectId: string;
  createdBy: string;
  title: string;
  assignees: { userId: string }[];
}> => {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      projectId: true,
      createdBy: true,
      title: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!t) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
  return t;
};

const findCommentOr404 = async (commentId: string): Promise<CommentWithAuthor & { task: { projectId: string } }> => {
  const c = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { author: { select: { id: true, name: true } }, task: { select: { projectId: true } } },
  });
  if (!c) throw ApiError.notFound('Comment not found', 'COMMENT_NOT_FOUND');
  return c;
};

export const canUpdateComment = (
  authorId: string,
  actorId: string,
  systemRole: SystemRole,
): boolean => {
  return actorId === authorId || systemRole === 'admin';
};

export const canDeleteComment = (
  authorId: string,
  actorId: string,
  systemRole: SystemRole,
  projectRole: ProjectRoleOrAdmin | null,
): boolean => {
  if (actorId === authorId) return true;
  if (systemRole === 'admin') return true;
  if (projectRole === 'admin' || projectRole === 'pm') return true;
  return false;
};

const buildCursorWhere = (cursor?: string): Prisma.CommentWhereInput | undefined => {
  if (!cursor) return undefined;
  const { createdAt, id } = decodeCursor(cursor);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: id } },
    ],
  };
};

// Resolve every parsed mention to the subset that is a real project member
// (admin role bypass — matches `ensureAssigneeIsProjectMember`'s pattern).
// Non-members are silently dropped so a malicious sender cannot enumerate
// user existence by mention spam.
const resolveValidMentionMembers = async (
  projectId: string,
  parsedIds: string[],
): Promise<Set<string>> => {
  if (parsedIds.length === 0) return new Set();
  const users = await prisma.user.findMany({
    where: { id: { in: parsedIds } },
    select: { id: true, role: true },
  });
  const admins = new Set(users.filter((u) => u.role === Role.admin).map((u) => u.id));
  const nonAdminIds = users.filter((u) => u.role !== Role.admin).map((u) => u.id);
  const members =
    nonAdminIds.length > 0
      ? await prisma.projectMember.findMany({
          where: { projectId, userId: { in: nonAdminIds } },
          select: { userId: true },
        })
      : [];
  const memberIds = new Set(members.map((m) => m.userId));
  const valid = new Set<string>();
  for (const id of parsedIds) {
    if (admins.has(id) || memberIds.has(id)) valid.add(id);
  }
  return valid;
};

const create = async (
  taskId: string,
  authorId: string,
  body: string,
): Promise<CommentDTO> => {
  const task = await ensureTaskExists(taskId);

  // Parse + cap-check mentions BEFORE opening the tx so a 422 reply does
  // not leave half-written comment rows behind.
  const parsedMentionIds = parseMentions(body);
  if (parsedMentionIds.length > MAX_MENTIONS_PER_COMMENT) {
    throw ApiError.unprocessable(
      `Too many mentions (max ${MAX_MENTIONS_PER_COMMENT}).`,
      'TOO_MANY_MENTIONS',
    );
  }
  const validMentionSet = await resolveValidMentionMembers(task.projectId, parsedMentionIds);

  return prisma.$transaction(async (tx) => {
    const row = await tx.comment.create({
      data: { taskId, authorId, body },
      include: { author: { select: { id: true, name: true } } },
    });
    await recordActivity(tx, {
      actorId: authorId,
      action: 'comment.created',
      entityType: 'comment',
      entityId: row.id,
      projectId: task.projectId,
      meta: { title: body.slice(0, 80) },
    });

    const excerpt = body.slice(0, 140);
    const payload = {
      taskTitle: task.title,
      taskId,
      commentId: row.id,
      commentExcerpt: excerpt,
    } as const;

    // comment.created → assignees ∪ creator MINUS anyone we're about to
    // tag with the more specific comment.mention. Actor self-skip handled
    // downstream by `enqueue`.
    const createdRecipients = new Set<string>();
    for (const a of task.assignees) createdRecipients.add(a.userId);
    if (task.createdBy) createdRecipients.add(task.createdBy);
    for (const id of validMentionSet) createdRecipients.delete(id);
    await enqueueNotifications(
      tx,
      Array.from(createdRecipients).map((recipientId) => ({
        recipientId,
        actorId: authorId,
        type: 'comment.created' as const,
        entityType: 'comment',
        entityId: row.id,
        projectId: task.projectId,
        payload,
      })),
    );

    // comment.mention → validated project members only.
    if (validMentionSet.size > 0) {
      await enqueueNotifications(
        tx,
        Array.from(validMentionSet).map((recipientId) => ({
          recipientId,
          actorId: authorId,
          type: 'comment.mention' as const,
          entityType: 'comment',
          entityId: row.id,
          projectId: task.projectId,
          payload,
        })),
      );
    }

    return toDTO(row);
  });
};

const list = async (
  taskId: string,
  args: { limit: number; cursor?: string },
): Promise<CommentListPage> => {
  await ensureTaskExists(taskId);
  const where: Prisma.CommentWhereInput = {
    taskId,
    ...(buildCursorWhere(args.cursor) ?? {}),
  };
  const rows = await prisma.comment.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: args.limit + 1,
    include: { author: { select: { id: true, name: true } } },
  });
  let nextCursor: string | null = null;
  if (rows.length > args.limit) {
    const last = rows[args.limit - 1];
    nextCursor = encodeCursor({ createdAt: last.createdAt, id: last.id });
    rows.length = args.limit;
  }
  return { items: rows.map(toDTO), nextCursor };
};

const update = async (
  commentId: string,
  actor: { id: string; role: SystemRole },
  body: string,
): Promise<CommentDTO> => {
  const existing = await findCommentOr404(commentId);
  if (!canUpdateComment(existing.authorId, actor.id, actor.role)) {
    throw ApiError.forbidden('Cannot edit this comment', 'COMMENT_FORBIDDEN');
  }
  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body },
    include: { author: { select: { id: true, name: true } } },
  });
  return toDTO(updated);
};

const remove = async (
  commentId: string,
  actor: { id: string; role: SystemRole },
  projectRole: ProjectRoleOrAdmin | null,
): Promise<void> => {
  const existing = await findCommentOr404(commentId);
  if (!canDeleteComment(existing.authorId, actor.id, actor.role, projectRole)) {
    throw ApiError.forbidden('Cannot delete this comment', 'COMMENT_FORBIDDEN');
  }
  await prisma.$transaction(async (tx) => {
    await recordActivity(tx, {
      actorId: actor.id,
      action: 'comment.deleted',
      entityType: 'comment',
      entityId: existing.id,
      projectId: existing.task.projectId,
      meta: { title: existing.body.slice(0, 80) },
    });
    await tx.comment.delete({ where: { id: commentId } });
  });
};

export const commentService = {
  create,
  list,
  update,
  remove,
  canUpdateComment,
  canDeleteComment,
};
