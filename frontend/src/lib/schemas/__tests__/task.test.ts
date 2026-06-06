import { describe, it, expect } from 'vitest';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  TASK_MAX_LIMIT,
  TASK_DEFAULT_LIMIT,
  TASK_DEFAULT_SORT,
} from '../task';

const validUuid = '123e4567-e89b-42d3-a456-426614174000';

describe('task schemas', () => {
  describe('createTaskSchema', () => {
    it('accepts valid + defaults status=todo + priority=medium', () => {
      const r = createTaskSchema.parse({
        projectId: validUuid,
        title: 'Ship feature',
        dueDate: '2030-01-01',
      });
      expect(r.status).toBe('todo');
      expect(r.priority).toBe('medium');
      expect(r.dueDate).toBeInstanceOf(Date);
    });

    it('rejects empty title', () => {
      expect(() =>
        createTaskSchema.parse({ projectId: validUuid, title: '', dueDate: '2030-01-01' }),
      ).toThrow();
    });

    it('rejects invalid projectId', () => {
      expect(() =>
        createTaskSchema.parse({ projectId: 'not-uuid', title: 'X', dueDate: '2030-01-01' }),
      ).toThrow();
    });

    it('drops unknown assignedTo key (column removed — use assigneeIds)', () => {
      const r = createTaskSchema.parse({
        projectId: validUuid,
        title: 'X',
        dueDate: '2030-01-01',
        assignedTo: null,
      } as unknown);
      expect((r as { assignedTo?: unknown }).assignedTo).toBeUndefined();
    });
  });

  describe('updateTaskSchema', () => {
    it('accepts a single field', () => {
      const r = updateTaskSchema.parse({ status: 'completed' });
      expect(r.status).toBe('completed');
    });

    it('rejects empty object', () => {
      expect(() => updateTaskSchema.parse({})).toThrow();
    });

    it('drops unknown assignedTo key (use assignees endpoints instead)', () => {
      const r = updateTaskSchema.parse({ assignedTo: null, status: 'completed' } as unknown);
      expect((r as { assignedTo?: unknown }).assignedTo).toBeUndefined();
    });
  });

  describe('listTasksQuerySchema', () => {
    it('defaults sort/page/limit when missing', () => {
      const r = listTasksQuerySchema.parse({});
      expect(r.sort).toBe(TASK_DEFAULT_SORT);
      expect(r.page).toBe(1);
      expect(r.limit).toBe(TASK_DEFAULT_LIMIT);
    });

    it('caps limit at TASK_MAX_LIMIT', () => {
      const r = listTasksQuerySchema.parse({ limit: '999' });
      expect(r.limit).toBe(TASK_MAX_LIMIT);
    });

    it('rejects invalid status', () => {
      expect(() => listTasksQuerySchema.parse({ status: 'bogus' })).toThrow();
    });

    it('rejects invalid priority', () => {
      expect(() => listTasksQuerySchema.parse({ priority: 'bogus' })).toThrow();
    });

    it('accepts assignedTo string passthrough (uuid or "unassigned")', () => {
      const r1 = listTasksQuerySchema.parse({ assignedTo: validUuid });
      const r2 = listTasksQuerySchema.parse({ assignedTo: 'unassigned' });
      expect(r1.assignedTo).toBe(validUuid);
      expect(r2.assignedTo).toBe('unassigned');
    });
  });
});
