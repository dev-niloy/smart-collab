import { parseMentions, MAX_MENTIONS_PER_COMMENT } from '../comment.mentions';

const UUID_A = '11111111-2222-4333-8444-555555555555';
const UUID_B = '66666666-7777-4888-9999-aaaaaaaaaaaa';
const UUID_C = 'bbbbbbbb-cccc-4ddd-9eee-ffffffffffff';

describe('parseMentions', () => {
  it('returns empty array for empty body', () => {
    expect(parseMentions('')).toEqual([]);
  });

  it('returns empty array when body has no token', () => {
    expect(parseMentions('Hello world, no mention here.')).toEqual([]);
  });

  it('extracts a single mention', () => {
    expect(parseMentions(`Hey @[Demo Member](${UUID_A}) please confirm.`)).toEqual([UUID_A]);
  });

  it('extracts multiple distinct mentions in first-occurrence order', () => {
    const body = `@[A](${UUID_A}) ping @[B](${UUID_B}) and also @[C](${UUID_C})`;
    expect(parseMentions(body)).toEqual([UUID_A, UUID_B, UUID_C]);
  });

  it('deduplicates repeat mentions of the same userId, preserving first occurrence', () => {
    const body = `@[A](${UUID_A}) and @[B](${UUID_B}) plus @[A again](${UUID_A})`;
    expect(parseMentions(body)).toEqual([UUID_A, UUID_B]);
  });

  it('rejects a truncated UUID (silent drop, no mention parsed)', () => {
    expect(parseMentions(`@[X](${UUID_A.slice(0, 30)})`)).toEqual([]);
  });

  it('rejects a UUID with the wrong hyphen pattern', () => {
    expect(parseMentions(`@[X](1111111122224333844455555555-5555)`)).toEqual([]);
  });

  it('rejects a non-hex UUID', () => {
    expect(parseMentions(`@[X](gggggggg-2222-4333-8444-555555555555)`)).toEqual([]);
  });

  it('matches a mention immediately followed by punctuation', () => {
    expect(parseMentions(`Ping @[Dev](${UUID_A}), thanks!`)).toEqual([UUID_A]);
  });

  it('matches a mention at the start of the body', () => {
    expect(parseMentions(`@[Dev](${UUID_A}) please.`)).toEqual([UUID_A]);
  });

  it('matches a mention at the end of the body', () => {
    expect(parseMentions(`Thanks @[Dev](${UUID_A})`)).toEqual([UUID_A]);
  });

  it('still captures mentions inside a code fence (parser is dumb; renderer handles fence escaping)', () => {
    const body = '```\nrun cmd then ping @[Dev](' + UUID_A + ')\n```';
    expect(parseMentions(body)).toEqual([UUID_A]);
  });

  it('exposes MAX_MENTIONS_PER_COMMENT = 20 for the service-layer cap check', () => {
    expect(MAX_MENTIONS_PER_COMMENT).toBe(20);
  });

  it('does not cap inside parseMentions — caller enforces the limit', () => {
    const ids = Array.from({ length: 25 }, (_, i) =>
      `${i.toString(16).padStart(8, '0')}-aaaa-4bbb-9ccc-dddddddddddd`,
    );
    const body = ids.map((id, i) => `@[U${i}](${id})`).join(' ');
    expect(parseMentions(body)).toHaveLength(25);
  });
});
