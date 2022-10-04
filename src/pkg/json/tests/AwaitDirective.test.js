import { JsonExpander } from '@this/json';


const doExpand = async (value) => {
  const jx = new JsonExpander();
  return jx.expandAsync(value);
};

test('throws when used synchronously', () => {
  const orig   = { $await: () => 123 };
  const jx     = new JsonExpander();

  expect(() => jx.expand(orig)).toThrow();
});

// `$await` is supposed to provide a final value, not one that undergoes further
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
  [{ $await: 'not really a directive' }]
])('for %o', (value) => {
  test('result === function-wrapped argument', async () => {
    const orig = { $await: () => value };
    const result = await doExpand(orig);
    expect(result).toBe(value);
  });

  test('result === promise-wrapped argument', async () => {
    const orig = { $await: () => Promise.resolve(value) };
    const result = await doExpand(orig);
    expect(result).toBe(value);
  });

  test('result === promise-wrapped argument (in array)', async () => {
    const orig = [{ $await: () => Promise.resolve(value) }];
    const result = await doExpand(orig);
    expect(result[0]).toBe(value);
    expect(result).toStrictEqual([value]);
  });

  test('result === promise-wrapped argument (in object)', async () => {
    const orig = { like: { $await: () => Promise.resolve(value) } };
    const result = await doExpand(orig);
    expect(result.like).toBe(value);
    expect(result).toStrictEqual({ like: value });
  });
});
