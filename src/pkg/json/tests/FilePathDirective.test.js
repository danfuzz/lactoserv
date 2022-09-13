import { JsonExpander } from '@this/json';

const doExpand = (value) => {
  const jx = new JsonExpander();
  return jx.expand(value);
};

describe.each([
  ['/',         '/'],
  ['/x',        '/x'],
  ['/x/y',      '/x/y'],
  ['/./x',      '/x'],
  ['/x/.',      '/x'],
  ['/x/y/../z', '/x/z']
])('for absolute path %o', (value, expected) => {
  test('succeeds at root', () => {
    const orig   = { $filePath: value };
    const result = doExpand(orig);
    expect(result).toStrictEqual(expected);
  });

  test('succeeds at non-root (object)', () => {
    const orig   = { a: { $filePath: value } };
    const result = doExpand(orig);
    expect(result).toStrictEqual({ a: expected });
  });
});

describe.each([
  ['.',      '/A/B'],
  ['..',     '/A'],
  ['x',      '/A/B/x'],
  ['x/y',    '/A/B/x/y'],
  ['x/./y',  '/A/B/x/y'],
  ['x/../y', '/A/B/y'],
])('for absolute path %o', (value, expected) => {
  test('throws without a $baseDir', () => {
    const orig   = { $filePath: value };
    expect(() => doExpand(orig)).toThrow();
  });

  test('succeeds at root', () => {
    const orig   = { $baseDir: '/A/B', $filePath: value };
    const result = doExpand(orig);
    expect(result).toStrictEqual(expected);
  });

  test('succeeds at non-root (object)', () => {
    const orig   = { $baseDir: '/A/B', a: { $filePath: value } };
    const result = doExpand(orig);
    expect(result).toStrictEqual({ a: expected });
  });
});
