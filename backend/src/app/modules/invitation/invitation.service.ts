import crypto from 'node:crypto';
import type { ProjectInvitation, ProjectRole } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { enqueueEmailJob } from '../email/email.queue';
import { recordActivity } from '../activityLog/activityLog.service';
import { enqueue as enqueueNotification } from '../notification/notification.service';
import { fanoutEmailJobs } from '../email/email.enqueue';
import {
  INVITATION_TTL_DAYS,
  ERR_INVITATION_NOT_FOUND,
  INVITATION_NOT_FOUND_MESSAGE,
  ERR_INVITATION_EXPIRED,
  INVITATION_EXPIRED_MESSAGE,
  ERR_INVITATION_REVOKED,
  INVITATION_REVOKED_MESSAGE,
  ERR_INVITATION_ACCEPTED,
  INVITATION_ACCEPTED_MESSAGE,
  ERR_INVITATION_EMAIL_MISMATCH,
  INVITATION_EMAIL_MISMATCH_MESSAGE,
  ERR_INVITATION_ALREADY_MEMBER,
  INVITATION_ALREADY_MEMBER_MESSAGE,
  ERR_INVITATION_PENDING_EXISTS,
  INVITATION_PENDING_EXISTS_MESSAGE,
} from './invitation.constant';

export type PublicInvitation = {
  id: string;
  projectId: string;
  email: string;
  role: ProjectRole;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptUrl: string | null;
  createdBy: { id: string; name: string; email: string };
};

const newToken = (): string => crypto.randomBytes(32).toString('base64url');

const acceptUrlFor = (token: string): string => {
  const base = (process.env.PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  return base ? `${base}/invitations/${token}` : `/invitations/${token}`;
};

const toPublic = (
  inv: ProjectInvitation & { createdBy: { id: string; name: string; email: string } },
  includeToken: boolean,
): PublicInvitation => ({
  id: inv.id,
  projectId: inv.projectId,
  email: inv.email,
  role: inv.role,
  status: inv.status,
  createdAt: inv.createdAt.toISOString(),
  expiresAt: inv.expiresAt.toISOString(),
  acceptedAt: inv.acceptedAt ? inv.acceptedAt.toISOString() : null,
  acceptUrl: includeToken ? acceptUrlFor(inv.token) : null,
  createdBy: inv.createdBy,
});

const computeStatus = (
  inv: Pick<ProjectInvitation, 'status' | 'expiresAt'>,
): ProjectInvitation['status'] => {
  if (inv.status === 'pending' && inv.expiresAt.getTime() < Date.now()) return 'expired';
  return inv.status;
};

const listForProject = async (projectId: string): Promise<PublicInvitation[]> => {
  const rows = await prisma.projectInvitation.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  return rows.map((r) => {
    const derived = computeStatus(r);
    return toPublic({ ...r, status: derived }, derived === 'pending');
  });
};

const createInvitation = async (params: {
  projectId: string;
  email: string;
  role: ProjectRole;
  actorId: string;
}): Promise<PublicInvitation> => {
  const { projectId, email, role, actorId } = params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, description: true },
  });
  if (!project) throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');

  // Block invite if already a member
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    const existingMember = await prisma.projectMember.findUnique({
      where: { project_members_project_user_unique: { projectId, userId: existingUser.id } },
      select: { id: true },
    });
    if (existingMember) {
      throw ApiError.unprocessable(INVITATION_ALREADY_MEMBER_MESSAGE, ERR_INVITATION_ALREADY_MEMBER);
    }
  }

  // Block if a pending invite already exists for this email + project
  const pending = await prisma.projectInvitation.findFirst({
    where: { projectId, email, status: 'pending' },
    select: { id: true, expiresAt: true },
  });
  if (pending && pending.expiresAt.getTime() > Date.now()) {
    throw ApiError.unprocessable(
      INVITATION_PENDING_EXISTS_MESSAGE,
      ERR_INVITATION_PENDING_EXISTS,
    );
  }
  if (pending) {
    // Stale pending — mark expired so the new one is the live record
    await prisma.projectInvitation.update({
      where: { id: pending.id },
      data: { status: 'expired' },
    });
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const token = newToken();

  const inv = await prisma.projectInvitation.create({
    data: {
      projectId,
      email,
      role,
      token,
      createdById: actorId,
      expiresAt,
    },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });

  await recordActivity(prisma, {
    actorId,
    action: 'invitation.created',
    entityType: 'invitation',
    entityId: inv.id,
    projectId,
    meta: { email, role },
  });

  // Direct enqueue (not fanout) — recipient is an email, not a User row.
  const inviter = await prisma.user.findUnique({
    where: { id: actorId },
    select: { name: true },
  });
  await enqueueEmailJob({
    name: 'project.invitation',
    data: {
      recipientId: existingUser?.id ?? `invitation:${inv.id}`,
      recipientEmail: email,
      recipientName: email,
      actorName: inviter?.name ?? null,
      type: 'project.invitation',
      payload: {
        projectId,
        projectName: project.name,
        projectDescription: project.description ?? undefined,
        newRole: role,
        invitationToken: token,
        invitationAcceptUrl: acceptUrlFor(token),
        invitationExpiresAt: expiresAt.toISOString(),
        inviterName: inviter?.name ?? undefined,
      },
    },
  });

  return toPublic(inv, true);
};

const revokeInvitation = async (params: {
  projectId: string;
  invitationId: string;
  actorId: string;
}): Promise<PublicInvitation> => {
  const inv = await prisma.projectInvitation.findUnique({
    where: { id: params.invitationId },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  if (!inv || inv.projectId !== params.projectId) {
    throw ApiError.notFound(INVITATION_NOT_FOUND_MESSAGE, ERR_INVITATION_NOT_FOUND);
  }
  if (inv.status === 'accepted') {
    throw ApiError.unprocessable(INVITATION_ACCEPTED_MESSAGE, ERR_INVITATION_ACCEPTED);
  }
  const updated = await prisma.projectInvitation.update({
    where: { id: inv.id },
    data: { status: 'revoked' },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
  await recordActivity(prisma, {
    actorId: params.actorId,
    action: 'invitation.revoked',
    entityType: 'invitation',
    entityId: inv.id,
    projectId: inv.projectId,
    meta: { email: inv.email },
  });
  return toPublic(updated, false);
};

export type PublicInvitationLookup = {
  id: string;
  email: string;
  role: ProjectRole;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  project: { id: string; name: string; description: string | null };
  inviter: { name: string; email: string };
};

const lookupByToken = async (token: string): Promise<PublicInvitationLookup> => {
  const inv = await prisma.projectInvitation.findUnique({
    where: { token },
    include: {
      project: { select: { id: true, name: true, description: true } },
      createdBy: { select: { name: true, email: true } },
    },
  });
  if (!inv) {
    throw ApiError.notFound(INVITATION_NOT_FOUND_MESSAGE, ERR_INVITATION_NOT_FOUND);
  }
  const status = computeStatus(inv);
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role,
    status,
    expiresAt: inv.expiresAt.toISOString(),
    project: inv.project,
    inviter: inv.createdBy,
  };
};

const acceptByToken = async (params: {
  token: string;
  userId: string;
}): Promise<{ projectId: string }> => {
  const inv = await prisma.projectInvitation.findUnique({
    where: { token: params.token },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!inv) throw ApiError.notFound(INVITATION_NOT_FOUND_MESSAGE, ERR_INVITATION_NOT_FOUND);

  if (inv.status === 'revoked') {
    throw ApiError.unprocessable(INVITATION_REVOKED_MESSAGE, ERR_INVITATION_REVOKED);
  }
  if (inv.status === 'accepted') {
    throw ApiError.unprocessable(INVITATION_ACCEPTED_MESSAGE, ERR_INVITATION_ACCEPTED);
  }
  if (computeStatus(inv) === 'expired') {
    throw ApiError.unprocessable(INVITATION_EXPIRED_MESSAGE, ERR_INVITATION_EXPIRED);
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
  if (user.email.toLowerCase() !== inv.email.toLowerCase()) {
    throw ApiError.unprocessable(
      INVITATION_EMAIL_MISMATCH_MESSAGE,
      ERR_INVITATION_EMAIL_MISMATCH,
    );
  }

  // Idempotent: if already a member, just mark invitation accepted.
  const existing = await prisma.projectMember.findUnique({
    where: {
      project_members_project_user_unique: { projectId: inv.projectId, userId: user.id },
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    if (!existing) {
      const member = await tx.projectMember.create({
        data: {
          projectId: inv.projectId,
          userId: user.id,
          role: inv.role,
          addedById: inv.createdById,
        },
      });
      await recordActivity(tx, {
        actorId: user.id,
        action: 'invitation.accepted',
        entityType: 'invitation',
        entityId: inv.id,
        projectId: inv.projectId,
        meta: { email: inv.email, role: inv.role, memberId: member.id },
      });
      await enqueueNotification(tx, {
        recipientId: inv.createdById,
        actorId: user.id,
        type: 'project.member_added',
        entityType: 'member',
        entityId: member.id,
        projectId: inv.projectId,
        payload: {
          projectName: inv.project.name,
          memberId: member.id,
          newRole: member.role,
        },
      });
    }
    await tx.projectInvitation.update({
      where: { id: inv.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedById: user.id,
      },
    });
  });

  // Best-effort: tell the inviter who accepted (uses standard fanout w/ a user
  // recipient who has a real account).
  await fanoutEmailJobs({
    recipientIds: [inv.createdById],
    actorId: user.id,
    actorName: user.name,
    type: 'project.member_added',
    payload: {
      projectId: inv.projectId,
      projectName: inv.project.name,
      newRole: inv.role,
    },
  });

  return { projectId: inv.projectId };
};

export const invitationService = {
  listForProject,
  createInvitation,
  revokeInvitation,
  lookupByToken,
  acceptByToken,
};
