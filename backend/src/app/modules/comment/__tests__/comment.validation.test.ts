import {
  createCommentBodySchema,
  updateCommentBodySchema,
  listCommentsQuerySchema,
} from '../comment.validation';
import { MAX_COMMENT_BODY, DEFAULT_COMMENT_LIST_LIMIT, MAX_COMMENT_LIST_LIMIT } from '../comment.constant';

describe('comment validation', () => {
  it('rejects empty body', () => {
    const r = createCommentBodySchema.safeParse({ body: '' });
    expect(r.success).toBe(false);
  });

  it('rejects whitespace-only body', () => {
    const r = createCommentBodySchema.safeParse({ body: '   ' });
    expect(r.success).toBe(false);
  });

  it('trims body and accepts up to MAX_COMMENT_BODY chars', () => {
    const exactly = 'x'.repeat(MAX_COMMENT_BODY);
    const r = createCommentBodySchema.safeParse({ body: `  ${exactly}  ` });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.body).toBe(exactly);
      expect(r.data.body.length).toBe(MAX_COMMENT_BODY);
    }
  });

  it('rejects body over MAX_COMMENT_BODY', () => {
    const r = createCommentBodySchema.safeParse({ body: 'x'.repeat(MAX_COMMENT_BODY + 1) });
    expect(r.success).toBe(false);
  });

  it('updateCommentBodySchema enforces same rules', () => {
    const ok = updateCommentBodySchema.safeParse({ body: 'updated body' });
    expect(ok.success).toBe(true);
    const tooLong = updateCommentBodySchema.safeParse({ body: 'x'.repeat(MAX_COMMENT_BODY + 1) });
    expect(tooLong.success).toBe(false);
  });

  it('listCommentsQuerySchema defaults + cursor optional + limit bounds', () => {
    const defaulted = listCommentsQuerySchema.parse({});
    expect(defaulted.limit).toBe(DEFAULT_COMMENT_LIST_LIMIT);
    expect(defaulted.cursor).toBeUndefined();

    const ok = listCommentsQuerySchema.parse({ limit: '25', cursor: 'abc' });
    expect(ok.limit).toBe(25);
    expect(ok.cursor).toBe('abc');

    const tooHigh = listCommentsQuerySchema.safeParse({ limit: MAX_COMMENT_LIST_LIMIT + 1 });
    expect(tooHigh.success).toBe(false);
    const zero = listCommentsQuerySchema.safeParse({ limit: 0 });
    expect(zero.success).toBe(false);
  });
});
