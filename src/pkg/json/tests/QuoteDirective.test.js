import { JsonExpander } from '@this/json';

const doExpand = (value) => {
  const jx = new JsonExpander();
  return jx.expand(value);
}

// `$quote` is supposed to provide a final value, not one that undergoes further
// expansion, which is why its expanded results are checked for `===`ness.
describe.each([
  [null],
  [false],
  [true],
  [0],
  [1.234],
  [''],
  ['florp'],
  [[1, 2, 3]],
  [{ a: 10, b: 20 }],
  [{ $quote: 'not really a directive' }]
])('for %o', (value) => {
  test('result === argument', () => {
    const orig = { $quote: value };
    const result = doExpand(orig);
    expect(result).toBe(value);
  });

  test('result === argument (in array)', () => {
    const orig = [111, { $quote: value }, 333];
    const result = doExpand(orig);
    expect(result[1]).toBe(value);
    expect(result).toStrictEqual([111, value, 333]);
  });

  test('result === argument (in object)', () => {
    const orig = { a: 'aaa', q: { $quote: value }, z: 'zzz' };
    const result = doExpand(orig);
    expect(result.q).toBe(value);
    expect(result).toStrictEqual({ ...orig, q: value });
  });
});
