import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
  projectIdParamSchema,
} from '../project.validation';
import { MAX_LIMIT, STATUSES, PAST_DEADLINE_MESSAGE } from '../project.constant';

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

describe('project.constant', () => {
  it('exports the 3 ProjectStatus enum values', () => {
    expect(STATUSES.map(String).sort()).toEqual(['active', 'completed', 'on_hold']);
  });
  it('exports the assessment-verbatim deadline message', () => {
    expect(PAST_DEADLINE_MESSAGE).toBe('Please select a valid deadline.');
  });
});

describe('createProjectSchema', () => {
  it('accepts minimal valid body', () => {
    const r = createProjectSchema.safeParse({ name: 'Site Redesign', deadline: future });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe('active');
  });

  it('rejects empty name', () => {
    const r = createProjectSchema.safeParse({ name: '', deadline: future });
    expect(r.success).toBe(false);
  });

  it('rejects name > 200 chars', () => {
    const r = createProjectSchema.safeParse({ name: 'x'.repeat(201), deadline: future });
    expect(r.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const r = createProjectSchema.safeParse({ name: 'x', deadline: future, status: 'banana' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid deadline string', () => {
    const r = createProjectSchema.safeParse({ name: 'x', deadline: 'not-a-date' });
    expect(r.success).toBe(false);
  });

  it('past deadline passes validation (service layer enforces — defense in depth)', () => {
    const r = createProjectSchema.safeParse({ name: 'x', deadline: past });
    expect(r.success).toBe(true);
  });
});

describe('updateProjectSchema', () => {
  it('accepts partial update', () => {
    const r = updateProjectSchema.safeParse({ name: 'New name' });
    expect(r.success).toBe(true);
  });

  it('rejects empty body (no fields)', () => {
    const r = updateProjectSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe('listProjectsQuerySchema', () => {
  it('defaults page=1 limit=10 sort=created on empty query', () => {
    const r = listProjectsQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBe(10);
      expect(r.data.sort).toBe('created');
    }
  });

  it('coerces page/limit strings to numbers', () => {
    const r = listProjectsQuerySchema.safeParse({ page: '3', limit: '20' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(3);
      expect(r.data.limit).toBe(20);
    }
  });

  it('caps limit at MAX_LIMIT', () => {
    const r = listProjectsQuerySchema.safeParse({ limit: 999 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(MAX_LIMIT);
  });

  it('rejects negative page', () => {
    const r = listProjectsQuerySchema.safeParse({ page: -1 });
    expect(r.success).toBe(false);
  });

  it('rejects unknown sort key', () => {
    const r = listProjectsQuerySchema.safeParse({ sort: 'random' });
    expect(r.success).toBe(false);
  });

  it('drops unknown status silently (passthrough as undefined)', () => {
    const r = listProjectsQuerySchema.safeParse({ status: 'bogus' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBeUndefined();
  });

  it('keeps known status (single value as 1-element array)', () => {
    const r = listProjectsQuerySchema.safeParse({ status: 'completed' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toEqual(['completed']);
  });

  it('accepts status csv → array', () => {
    const r = listProjectsQuerySchema.safeParse({ status: 'active,on_hold' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toEqual(['active', 'on_hold']);
  });

  it('drops unknown tokens inside csv silently', () => {
    const r = listProjectsQuerySchema.safeParse({ status: 'active,bogus,completed' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toEqual(['active', 'completed']);
  });

  it('parses deadlineFrom + deadlineTo ISO dates', () => {
    const r = listProjectsQuerySchema.safeParse({
      deadlineFrom: '2026-06-04',
      deadlineTo: '2026-12-31',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.deadlineFrom).toBeInstanceOf(Date);
      expect(r.data.deadlineTo).toBeInstanceOf(Date);
    }
  });

  it('rejects bad deadlineFrom date', () => {
    const r = listProjectsQuerySchema.safeParse({ deadlineFrom: 'not-a-date' });
    expect(r.success).toBe(false);
  });

  it('rejects deadlineFrom > deadlineTo', () => {
    const r = listProjectsQuerySchema.safeParse({
      deadlineFrom: '2026-12-01',
      deadlineTo: '2026-06-01',
    });
    expect(r.success).toBe(false);
  });

  it('accepts createdBy=me literal', () => {
    const r = listProjectsQuerySchema.safeParse({ createdBy: 'me' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.createdBy).toBe('me');
  });

  it('accepts createdBy=uuid', () => {
    const r = listProjectsQuerySchema.safeParse({
      createdBy: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.createdBy).toBe('123e4567-e89b-12d3-a456-426614174000');
  });
});

describe('projectIdParamSchema', () => {
  it('accepts valid uuid', () => {
    const r = projectIdParamSchema.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' });
    expect(r.success).toBe(true);
  });
  it('rejects non-uuid', () => {
    const r = projectIdParamSchema.safeParse({ id: 'not-a-uuid' });
    expect(r.success).toBe(false);
  });
});
