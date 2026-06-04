import { searchQuerySchema } from '../search.validation';

describe('search.validation', () => {
  it('accepts q.length >= 2 + default limit=5', () => {
    const r = searchQuerySchema.parse({ q: 'fo' });
    expect(r.q).toBe('fo');
    expect(r.limit).toBe(5);
  });

  it('rejects q.length < 2', () => {
    expect(() => searchQuerySchema.parse({ q: 'a' })).toThrow();
  });

  it('rejects q.length > 200', () => {
    expect(() => searchQuerySchema.parse({ q: 'a'.repeat(201) })).toThrow();
  });

  it('coerces limit + caps at 20', () => {
    const r = searchQuerySchema.parse({ q: 'foo', limit: '10' });
    expect(r.limit).toBe(10);
    expect(() => searchQuerySchema.parse({ q: 'foo', limit: '21' })).toThrow();
  });

  it('rejects missing q', () => {
    expect(() => searchQuerySchema.parse({})).toThrow();
  });
});
