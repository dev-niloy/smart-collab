import { describe, it, expect } from 'vitest';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
  PROJECT_MAX_LIMIT,
  PROJECT_DEFAULT_LIMIT,
  PROJECT_DEFAULT_SORT,
} from '../project';

describe('project schemas', () => {
  describe('createProjectSchema', () => {
    it('accepts valid input + defaults status to active', () => {
      const r = createProjectSchema.parse({ name: 'X', deadline: '2030-01-01' });
      expect(r.status).toBe('active');
      expect(r.deadline).toBeInstanceOf(Date);
    });

    it('rejects empty name', () => {
      expect(() => createProjectSchema.parse({ name: '', deadline: '2030-01-01' })).toThrow();
    });

    it('rejects invalid deadline', () => {
      expect(() => createProjectSchema.parse({ name: 'X', deadline: 'not-a-date' })).toThrow();
    });
  });

  describe('updateProjectSchema', () => {
    it('accepts a single field', () => {
      const r = updateProjectSchema.parse({ name: 'Y' });
      expect(r.name).toBe('Y');
    });

    it('rejects empty object', () => {
      expect(() => updateProjectSchema.parse({})).toThrow();
    });
  });

  describe('listProjectsQuerySchema', () => {
    it('defaults sort/page/limit when missing', () => {
      const r = listProjectsQuerySchema.parse({});
      expect(r.sort).toBe(PROJECT_DEFAULT_SORT);
      expect(r.page).toBe(1);
      expect(r.limit).toBe(PROJECT_DEFAULT_LIMIT);
    });

    it('caps limit at PROJECT_MAX_LIMIT', () => {
      const r = listProjectsQuerySchema.parse({ limit: '999' });
      expect(r.limit).toBe(PROJECT_MAX_LIMIT);
    });

    it('rejects invalid status', () => {
      expect(() => listProjectsQuerySchema.parse({ status: 'bogus' })).toThrow();
    });
  });
});
