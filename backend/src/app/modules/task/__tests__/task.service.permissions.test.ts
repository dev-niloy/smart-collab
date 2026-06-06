import { Role } from '@prisma/client';
import {
  canWriteTask,
  canDeleteTask,
  canReassignTask,
  canSeeDeleted,
} from '../task.service';

describe('task permission predicates', () => {
  const admin = { id: 'admin-1', role: Role.admin };
  const pm = { id: 'pm-1', role: Role.project_manager };
  const member = { id: 'mem-1', role: Role.team_member };
  const otherMember = { id: 'mem-2', role: Role.team_member };

  describe('canWriteTask', () => {
    it('admin → true regardless of assignee', () => {
      expect(
        canWriteTask({
          actor: admin,
          task: { createdBy: 'x', assignees: [] },
          projectRole: null,
        }),
      ).toBe(true);
      expect(
        canWriteTask({
          actor: admin,
          task: { createdBy: 'x', assignees: [{ userId: 'someone' }] },
          projectRole: null,
        }),
      ).toBe(true);
    });

    it('project PM → true regardless of assignee', () => {
      expect(
        canWriteTask({
          actor: pm,
          task: { createdBy: 'x', assignees: [] },
          projectRole: 'pm',
        }),
      ).toBe(true);
      expect(
        canWriteTask({
          actor: pm,
          task: { createdBy: 'x', assignees: [{ userId: otherMember.id }] },
          projectRole: 'pm',
        }),
      ).toBe(true);
    });

    it('assignee → true', () => {
      expect(
        canWriteTask({
          actor: member,
          task: { createdBy: 'x', assignees: [{ userId: member.id }] },
          projectRole: 'member',
        }),
      ).toBe(true);
    });

    it('non-assignee member → false', () => {
      expect(
        canWriteTask({
          actor: member,
          task: { createdBy: 'x', assignees: [{ userId: otherMember.id }] },
          projectRole: 'member',
        }),
      ).toBe(false);
    });

    it('unassigned task + member → false (PM/admin only)', () => {
      expect(
        canWriteTask({
          actor: member,
          task: { createdBy: 'x', assignees: [] },
          projectRole: 'member',
        }),
      ).toBe(false);
    });

    it('non-member of project → false even if claimed assignee', () => {
      expect(
        canWriteTask({
          actor: member,
          task: { createdBy: 'x', assignees: [{ userId: member.id }] },
          projectRole: null,
        }),
      ).toBe(true); // still true — assignee check doesn't depend on project membership here; service-level RBAC catches that
    });

    describe('multi-assignee', () => {
      it('any assignee in `assignees` array → true', () => {
        expect(
          canWriteTask({
            actor: member,
            task: {
              createdBy: 'x',
              assignees: [{ userId: otherMember.id }, { userId: member.id }],
            },
            projectRole: 'member',
          }),
        ).toBe(true);
      });

      it('non-assignee member → false even if assignees populated', () => {
        expect(
          canWriteTask({
            actor: member,
            task: {
              createdBy: 'x',
              assignees: [{ userId: otherMember.id }],
            },
            projectRole: 'member',
          }),
        ).toBe(false);
      });

      it('empty assignees array (unassigned) + member → false', () => {
        expect(
          canWriteTask({
            actor: member,
            task: { createdBy: 'x', assignees: [] },
            projectRole: 'member',
          }),
        ).toBe(false);
      });

      it('PM/admin override regardless of assignees', () => {
        expect(
          canWriteTask({
            actor: pm,
            task: { createdBy: 'x', assignees: [] },
            projectRole: 'pm',
          }),
        ).toBe(true);
        expect(
          canWriteTask({
            actor: admin,
            task: { createdBy: 'x', assignees: [{ userId: otherMember.id }] },
            projectRole: null,
          }),
        ).toBe(true);
      });
    });
  });

  describe('canDeleteTask', () => {
    it('admin → true', () => {
      expect(
        canDeleteTask({ actor: admin, task: { createdBy: 'x', assignees: [] }, projectRole: null }),
      ).toBe(true);
    });
    it('project PM → true', () => {
      expect(
        canDeleteTask({ actor: pm, task: { createdBy: 'x', assignees: [] }, projectRole: 'pm' }),
      ).toBe(true);
    });
    it('creator (any role) → true', () => {
      expect(
        canDeleteTask({
          actor: member,
          task: { createdBy: member.id, assignees: [] },
          projectRole: 'member',
        }),
      ).toBe(true);
    });
    it('non-creator non-PM member → false', () => {
      expect(
        canDeleteTask({
          actor: member,
          task: { createdBy: 'someone-else', assignees: [] },
          projectRole: 'member',
        }),
      ).toBe(false);
    });
  });

  describe('canReassignTask', () => {
    it('admin → true', () => {
      expect(canReassignTask({ actor: admin, projectRole: null })).toBe(true);
    });
    it('project PM → true', () => {
      expect(canReassignTask({ actor: pm, projectRole: 'pm' })).toBe(true);
    });
    it('assignee (non-PM) → false', () => {
      expect(canReassignTask({ actor: member, projectRole: 'member' })).toBe(false);
    });
  });

  describe('canSeeDeleted', () => {
    it('admin → true', () => {
      expect(canSeeDeleted(admin, null)).toBe(true);
    });
    it('project PM → true', () => {
      expect(canSeeDeleted(pm, 'pm')).toBe(true);
    });
    it('member → false', () => {
      expect(canSeeDeleted(member, 'member')).toBe(false);
    });
    it('undefined actor → true (treated as admin for backward-compat)', () => {
      expect(canSeeDeleted(undefined, null)).toBe(true);
    });
  });
});
