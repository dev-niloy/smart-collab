import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
} from '../task.validation';
import { MAX_LIMIT, UNASSIGNED } from '../task.constant';

const validUuid = '11111111-1111-1111-1111-111111111111';

describe('task validation', () => {
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

    it('accepts null assignedTo', () => {
      const r = createTaskSchema.parse({
        projectId: validUuid,
        title: 'X',
        dueDate: '2030-01-01',
        assignedTo: null,
      });
      expect(r.assignedTo).toBeNull();
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

    it('allows null assignedTo (unassign)', () => {
      const r = updateTaskSchema.parse({ assignedTo: null });
      expect(r.assignedTo).toBeNull();
    });
  });

  describe('listTasksQuerySchema', () => {
    it('defaults sort/page/limit', () => {
      const r = listTasksQuerySchema.parse({});
      expect(r.sort).toBe('created');
      expect(r.page).toBe(1);
      expect(r.limit).toBe(10);
    });

    it('caps limit at MAX_LIMIT', () => {
      const r = listTasksQuerySchema.parse({ limit: '999' });
      expect(r.limit).toBe(MAX_LIMIT);
    });

    it('coerces unknown status to undefined', () => {
      const r = listTasksQuerySchema.parse({ status: 'bogus' });
      expect(r.status).toBeUndefined();
    });

    it("accepts assignedTo='unassigned'", () => {
      const r = listTasksQuerySchema.parse({ assignedTo: UNASSIGNED });
      expect(r.assignedTo).toBe(UNASSIGNED);
    });

    it('accepts assignedTo=uuid', () => {
      const r = listTasksQuerySchema.parse({ assignedTo: validUuid });
      expect(r.assignedTo).toBe(validUuid);
    });

    it('drops invalid assignedTo silently', () => {
      const r = listTasksQuerySchema.parse({ assignedTo: 'not-uuid' });
      expect(r.assignedTo).toBeUndefined();
    });

    it('accepts status as csv → array', () => {
      const r = listTasksQuerySchema.parse({ status: 'todo,in_progress' });
      expect(r.status).toEqual(['todo', 'in_progress']);
    });

    it('keeps single status as 1-element array', () => {
      const r = listTasksQuerySchema.parse({ status: 'todo' });
      expect(r.status).toEqual(['todo']);
    });

    it('drops unknown enum tokens silently inside csv', () => {
      const r = listTasksQuerySchema.parse({ status: 'todo,bogus,in_progress' });
      expect(r.status).toEqual(['todo', 'in_progress']);
    });

    it('accepts priority csv', () => {
      const r = listTasksQuerySchema.parse({ priority: 'high,medium' });
      expect(r.priority).toEqual(['high', 'medium']);
    });

    it('parses dueFrom + dueTo ISO dates', () => {
      const r = listTasksQuerySchema.parse({
        dueFrom: '2026-06-04',
        dueTo: '2026-06-30',
      });
      expect(r.dueFrom).toBeInstanceOf(Date);
      expect(r.dueTo).toBeInstanceOf(Date);
    });

    it('rejects bad dueFrom date', () => {
      expect(() => listTasksQuerySchema.parse({ dueFrom: 'not-a-date' })).toThrow();
    });

    it('rejects dueFrom > dueTo', () => {
      expect(() =>
        listTasksQuerySchema.parse({ dueFrom: '2026-07-01', dueTo: '2026-06-01' }),
      ).toThrow();
    });

    it('accepts assignedTo=me literal', () => {
      const r = listTasksQuerySchema.parse({ assignedTo: 'me' });
      expect(r.assignedTo).toBe('me');
    });

    it('accepts createdBy=me literal', () => {
      const r = listTasksQuerySchema.parse({ createdBy: 'me' });
      expect(r.createdBy).toBe('me');
    });

    it('accepts createdBy=uuid', () => {
      const r = listTasksQuerySchema.parse({ createdBy: validUuid });
      expect(r.createdBy).toBe(validUuid);
    });
  });

  describe('taskIdParamSchema', () => {
    it('accepts valid uuid', () => {
      const r = taskIdParamSchema.parse({ id: validUuid });
      expect(r.id).toBe(validUuid);
    });

    it('rejects invalid uuid', () => {
      expect(() => taskIdParamSchema.parse({ id: 'not-uuid' })).toThrow();
    });
  });
});
