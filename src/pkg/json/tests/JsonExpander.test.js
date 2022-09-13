import { JsonExpander } from '@this/json';

test('constructor() succeeds', () => {
  new JsonExpander();
});

describe.each([
  ['expand', false],
  ['expandAsync', true]
])('.%s()', (methodName, doAwait) => {
  const doExpand = async (value) => {
    const jx     = new JsonExpander();
    const result = jx[methodName](value);

    if (doAwait) {
      expect(result).toEqual(expect.any(Promise));
    } else {
      expect(result).not.toEqual(expect.any(Promise));
    }

    return result;
  };

  test('trivial test', async () => {
    // This just checks that the method runs without throwing, in a super simple
    // case.
    await doExpand('hello');
  });

  // These are cases where the result should be `===` to the original.
  describe.each([
    [null],
    [false],
    [true],
    [-1],
    [0],
    [1],
    [1.234],
    ['florp']
  ])('for %o', (value) => {
    test('result === argument', async () => {
      const result = await doExpand(value);
      expect(result).toBe(value);
    });
  });

  // These are cases where the result should be equal but _not_ `===` to the
  // original.
  describe.each([
    [[]],
    [{}],
    [[1, 2, 3]],
    [{ a: 10, b: 20 }]
  ])('for %o', (value) => {
    test('result !== argument', async () => {
      const result = await doExpand(value);
      expect(result).not.toBe(value);
    });

    test('result equals argument', async () => {
      const result = await doExpand(value);
      expect(result).toStrictEqual(value);
    });
  });
});
