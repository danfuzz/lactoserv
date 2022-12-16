// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { LogTag } from '@this/loggy';


describe('constructor()', () => {
  describe('valid main tags', () => {
    test.each([
      ['a'],
      ['florp'],
      ['zorch-splat'],
      ['__florp99__'],
      ['2.44.123']
    ])('accepts %p', (value) => {
      expect(() => new LogTag(value)).not.toThrow();
    });
  });

  describe('invalid main tags', () => {
    test.each([
      [''],        // Not allowed to be empty.
      ['-florp'],  // No dot or dash at start/end
      ['florp-'],
      ['.florp'],
      ['florp.'],
      [undefined], // Must be a string.
      [null],
      [false],
      [true],
      [123],
      [['a']],
      [{ a: 10 }],
      [new Set('nope')]
    ])('throws given %p', (value) => {
      expect(() => new LogTag(value)).toThrow();
    });
  });

  describe('valid context strings', () => {
    test.each([
      ['a'],
      ['beep boop'],
      ['@#$%^&*']
    ])('accepts %p', (v) => {
      expect(() => new LogTag('x', v)).not.toThrow();
      expect(() => new LogTag('x', v, v)).not.toThrow();
      expect(() => new LogTag('x', v, v, v)).not.toThrow();
      expect(() => new LogTag('x', v, v, v, v)).not.toThrow();
      expect(() => new LogTag('x', v, v, v, v, v)).not.toThrow();
    });
  });

  describe('invalid context strings', () => {
    test.each([
      [''],        // Not allowed to be empty.
      ['123456789012345678901234567890!'], // Too long!
      [undefined], // Must be a string.
      [null],
      [false],
      [true],
      [123],
      [['a']],
      [{ a: 10 }],
      [new Set('nope')]
    ])('throws given %p', (i) => {
      const v = 'a';
      expect(() => new LogTag('x', i)).toThrow();
      expect(() => new LogTag('x', v, i)).toThrow();
      expect(() => new LogTag('x', v, v, i)).toThrow();
      expect(() => new LogTag('x', v, v, v, i)).toThrow();
      expect(() => new LogTag('x', v, v, v, v, i)).toThrow();
      expect(() => new LogTag('x', v, v, v, i, v)).toThrow();
      expect(() => new LogTag('x', v, v, i, v, v)).toThrow();
      expect(() => new LogTag('x', v, i, v, v, v)).toThrow();
      expect(() => new LogTag('x', i, v, v, v, v)).toThrow();
    });
  });
});

describe('.context', () => {
  describe.each([
    [[]],
    [['a']],
    [['a', 'b']],
    [['x', 'y', 'zorch']]
  ])('for %p', (values) => {
    test('is an array of the right size', () => {
      const tag = new LogTag('main', ...values);
      expect(tag.context).toBeArrayOfSize(values.length);
    });

    test('is frozen', () => {
      const tag = new LogTag('main', ...values);
      expect(tag.context).toBeFrozen();
    });

    test('has the expected contents', () => {
      const tag = new LogTag('main', ...values);
      expect(tag.context).toStrictEqual(values);
    });
  });
});

describe('.main', () => {
  test('is the value passed in the constructor', () => {
    const value = 'yep';
    expect(new LogTag(value).main).toBe(value);
  });
});

describe('withAddedContext()', () => {
  test('adds the indicated context', () => {
    const tag    = new LogTag('x', 'foo', 'bar');
    const result = tag.withAddedContext('zorch', 'florp');

    expect(result.context).toStrictEqual(['foo', 'bar', 'zorch', 'florp']);
  });
});

describe.each`
  label        | args       | endingMain | endingOther
  ${'<empty>'} | ${[]}      | ${''}      | ${''}
  ${'false'}   | ${[false]} | ${''}      | ${''}
  ${'true'}    | ${[true]}  | ${' '}     | ${'.'}
`('toHuman($label)', ({ args, endingMain, endingOther }) => {
  test('works with just a main tag (no context strings)', () => {
    const tag      = new LogTag('just-main');
    const expected = `<just-main>${endingMain}`;
    expect(tag.toHuman(...args)).toBe(expected);
  });

  test('works with a single context string', () => {
    const tag = new LogTag('main-and', 'one');
    const expected = `<main-and> one${endingOther}`;
    expect(tag.toHuman(...args)).toBe(expected);
  });

  test('works with 10 context strings', () => {
    const tag = new LogTag('whee', '1', '2', '3', '4', '5', '6', 'seven', '8', '9', 'ten');
    const expected = `<whee> 1.2.3.4.5.6.seven.8.9.ten${endingOther}`;
    expect(tag.toHuman(...args)).toBe(expected);
  });
});
