import { JsonExpander } from '@this/json';

const doExpand = (value) => {
  const jx = new JsonExpander();
  return jx.expand(value);
}

describe.each([
  ['/'],
  ['/x'],
  ['/x/y'],
  ['/like/florp/timeline/sideways']
])('for %o', (value) => {
  test('succeeds at root (no other bindings)', () => {
    const orig   = { $baseDir: value };
    const result = doExpand(orig);
    expect(result).toStrictEqual({});
  });

  test('succeeds at root (with one other binding)', () => {
    const expected = { a: 'yes' };
    const orig     = { $baseDir: value, ...expected };
    const result   = doExpand(orig);
    expect(result).toStrictEqual(expected);
  });

  test('succeeds at root (with a bunch of other bindings)', () => {
    const expected = { a: 'yes', b: [1, 2, 3], c: { t: true, f: false } };
    const orig     = { $baseDir: value, ...expected };
    const result   = doExpand(orig);
    expect(result).toStrictEqual(expected);
  });

  test('succeeds at root (with another directive bindings)', () => {
    const orig   = { $baseDir: value, $quote: 'yes' };
    const result = doExpand(orig);
    expect(result).toBe('yes');
  });
});

describe('fails at not-root', () => {
  test.each([
    [[{ $baseDir: '/x/y/z' }]],
    [{ x: { $baseDir: '/x/y/z' } }]
  ])('for %o', (value) => {
    expect(() => doExpand(value)).toThrow();
  });
});

describe('invalid paths', () => {
  test.each([
    [null],
    [123],
    [[1, 2, 3]],
    [''],
    ['.'],
    ['..'],
    ['./x'],
    ['../x'],
    ['x/.'],
    ['x/..'],
    ['x/./y'],
    ['x/../y'],
    ['x/./y/'],
    ['x/../y/'],
    ['/x/./y'],
    ['/x/../y'],
  ])('for %o', (value) => {
    const orig = { $baseDir: value };
    expect(() => doExpand(orig)).toThrow();
  });
});
