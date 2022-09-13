import { JsonExpander } from '@this/json';

const doExpand = (value) => {
  const jx = new JsonExpander();
  return jx.expand(value);
};

// Simple cases where we can expect `===`ness, because the value is selfless.
describe.each([
  [null],
  [false],
  [true],
  [0],
  [1.234],
  [''],
  ['florp']
])('for %o', (value) => {
  test('result === argument', () => {
    const orig = { $value: value };
    const result = doExpand(orig);
    expect(result).toBe(value);
  });

  test('result === argument (in array)', () => {
    const orig = ['yes', { $value: value }, 'YES'];
    const result = doExpand(orig);
    expect(result[1]).toBe(value);
    expect(result).toStrictEqual(['yes', value, 'YES']);
  });

  test('result === argument (in object)', () => {
    const orig = { a: 111, val: { $value: value }, z: true };
    const result = doExpand(orig);
    expect(result.val).toBe(value);
    expect(result).toStrictEqual({ ...orig, val: value });
  });
});

// `$value` is supposed to propagate processing into its embedded value, so we
// check for equal-ness but not `===`ness.
describe.each([
  [[1, 2, 3]],
  [{ a: 10, b: 20 }]
])('for %o', (value) => {
  test('result !== argument', () => {
    const orig = { $value: value };
    const result = doExpand(orig);
    expect(result).not.toBe(value);
  });

  test('result equals argument', async () => {
    const orig = { $value: value };
    const result = doExpand(orig);
    expect(result).toStrictEqual(value);
  });
});
