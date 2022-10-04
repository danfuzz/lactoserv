import { JsonExpander } from '@this/json';


const doExpand = (value) => {
  const jx = new JsonExpander();
  return jx.expand(value);
};

describe.each([
  [{}],
  [{ zorp: 'aaa' }],
  [{ like: ['now', 'florp'] }]
])('for %o', (value) => {
  test('succeeds at root (no other bindings)', () => {
    const orig   = { $defs: value };
    const result = doExpand(orig);
    expect(result).toStrictEqual({});
  });

  test('succeeds at root (with one other binding)', () => {
    const expected = { a: 'yes' };
    const orig     = { $defs: value, ...expected };
    const result   = doExpand(orig);
    expect(result).toStrictEqual(expected);
  });

  test('succeeds at root (with a bunch of other bindings)', () => {
    const expected = { a: 'yes', b: [1, 2, 3], c: { t: true, f: false } };
    const orig     = { $defs: value, ...expected };
    const result   = doExpand(orig);
    expect(result).toStrictEqual(expected);
  });

  test('succeeds at root (with another directive binding)', () => {
    const orig   = { $defs: value, $baseDir: '/yes' };
    const result = doExpand(orig);
    expect(result).toEqual({});
  });
});

describe('throws at non-root', () => {
  test.each([
    [[{ $defs: {} }]],
    [{ x: { $defs: { yes: 'no' } } }]
  ])('for %o', (value) => {
    expect(() => doExpand(value)).toThrow();
  });
});
