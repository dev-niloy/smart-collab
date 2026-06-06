import {
  productivityQuerySchema,
  upcomingQuerySchema,
} from '../dashboard.validation';

describe('productivityQuerySchema', () => {
  it('defaults to 30 days when omitted', () => {
    expect(productivityQuerySchema.parse({}).days).toBe(30);
  });

  it('coerces "10" string to 10', () => {
    expect(productivityQuerySchema.parse({ days: '10' }).days).toBe(10);
  });

  it('rejects 0', () => {
    expect(() => productivityQuerySchema.parse({ days: 0 })).toThrow();
  });

  it('rejects 366', () => {
    expect(() => productivityQuerySchema.parse({ days: 366 })).toThrow();
  });

  it('rejects NaN / non-numeric', () => {
    expect(() => productivityQuerySchema.parse({ days: 'abc' })).toThrow();
  });
});

describe('upcomingQuerySchema', () => {
  it('defaults to 7 days when omitted', () => {
    expect(upcomingQuerySchema.parse({}).days).toBe(7);
  });
});
