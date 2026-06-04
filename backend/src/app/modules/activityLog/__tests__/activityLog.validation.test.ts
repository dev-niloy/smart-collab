import {
  listQuerySchema,
  encodeCursor,
  decodeCursor,
} from '../activityLog.validation';

describe('activityLog.validation', () => {
  describe('listQuerySchema', () => {
    it('applies default limit 10', () => {
      const out = listQuerySchema.parse({});
      expect(out.limit).toBe(10);
      expect(out.cursor).toBeUndefined();
    });

    it('coerces string limit to int and accepts 1..50', () => {
      expect(listQuerySchema.parse({ limit: '25' }).limit).toBe(25);
      expect(listQuerySchema.parse({ limit: '50' }).limit).toBe(50);
      expect(listQuerySchema.parse({ limit: '1' }).limit).toBe(1);
    });

    it('rejects limit out of range', () => {
      expect(() => listQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => listQuerySchema.parse({ limit: 51 })).toThrow();
      expect(() => listQuerySchema.parse({ limit: 'NaN' })).toThrow();
    });

    it('accepts optional cursor string', () => {
      const out = listQuerySchema.parse({ cursor: 'abc' });
      expect(out.cursor).toBe('abc');
    });
  });

  describe('cursor codec', () => {
    it('encodes and decodes round-trip', () => {
      const at = new Date('2026-06-04T10:00:00.000Z');
      const id = '11111111-2222-3333-4444-555555555555';
      const c = encodeCursor({ createdAt: at, id });
      const d = decodeCursor(c);
      expect(d.id).toBe(id);
      expect(d.createdAt.toISOString()).toBe(at.toISOString());
    });

    it('throws on bad cursor', () => {
      expect(() => decodeCursor('not-base64$$')).toThrow();
      expect(() => decodeCursor(Buffer.from('not-json', 'utf8').toString('base64'))).toThrow();
    });
  });
});
