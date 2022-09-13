import { JsonExpander } from '@this/json';

test('constructor succeeds', () => {
  new JsonExpander();
});

describe.each([
  ['expand', false],
  ['expandAsync', true]
])('.%s()', (methodName, doAwait) => {
  test('trivial test', async () => {
    // This just checks that the method runs without throwing, in a super simple
    // case.
    const jx     = new JsonExpander();
    const result = jx[methodName]('hello');
    if (doAwait) {
      await result;
    }
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
      const jx        = new JsonExpander();
      const preResult = jx[methodName](value);
      const result    = doAwait ? await preResult : preResult;
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
  ])('returns equal but not `===` argument for %o', (value) => {
    test('result !== argument', async () => {
      const jx        = new JsonExpander();
      const preResult = jx[methodName](value);
      const result    = doAwait ? await preResult : preResult;
      expect(result).not.toBe(value);
    });

    test('result equals argument', async () => {
      const jx        = new JsonExpander();
      const preResult = jx[methodName](value);
      const result    = doAwait ? await preResult : preResult;
      expect(result).toEqual(value);
    });
  });
});
