import { JsonExpander } from '@this/json';

const doExpand = (value) => {
  const jx = new JsonExpander();
  return jx.expand(value);
};

describe.each([
  ['florp'],
  [{ florp: 'yes' }],
  [[1, 2, 3, 'florp']]
])('for %o', (value) => {
  test('succeeds at root', () => {
    const orig   = { $defs: { like: value }, $ref: '#/$defs/like' };
    const result = doExpand(orig);
    expect(result).toStrictEqual(value);
  });

  test('succeeds at non-root (simple binding)', () => {
    const orig   = { $defs: { like: value }, a: { $ref: '#/$defs/like' } };
    const result = doExpand(orig);
    expect(result).toStrictEqual({ a: value });
  });

  test('succeeds at non-root (in array)', () => {
    const orig   = { $defs: { like: value }, a: [{ $ref: '#/$defs/like' }] };
    const result = doExpand(orig);
    expect(result).toStrictEqual({ a: [value] });
  });
});

test('throws when there are no defs', () => {
  const orig = { $ref: '#/$defs/x' };
  expect(() => doExpand(orig)).toThrow();
});

test('throws when the named def is not found', () => {
  const orig = { $defs: { a: 'nope' }, $ref: '#/$defs/x' };
  expect(() => doExpand(orig)).toThrow();
});
