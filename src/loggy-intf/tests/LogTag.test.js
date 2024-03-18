// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import stripAnsi from 'strip-ansi';

import { BaseConverter, Struct } from '@this/data-values';
import { LogTag } from '@this/loggy-intf';


describe('constructor()', () => {
  describe('valid main tags', () => {
    test.each([
      ['a'],
      ['florp'],
      ['flippyFlop'],
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
      ['beep'],
      ['beepBoop'],
      ['beep boop'],
      ['beep-boop'],
      ['beep_boop'],
      ['0123456789'],
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

describe('equals()', () => {
  test('equals itself', () => {
    const tag = new LogTag('woo', 'yah');
    expect(tag.equals(tag)).toBeTrue();
  });

  test('equals an instance with `===` components', () => {
    const tag1 = new LogTag('yeah', 'yup', 'yeppers');
    const tag2 = new LogTag('yeah', 'yup', 'yeppers');
    expect(tag1.equals(tag2)).toBeTrue();
  });

  test('does not equal an instance with different main tags', () => {
    const tag1 = new LogTag('yeah', 'yup', 'yeppers');
    const tag2 = new LogTag('nope', 'yup', 'yeppers');
    expect(tag1.equals(tag2)).toBeFalse();
  });

  test('does not equal an instance with different context with same length', () => {
    const tag1 = new LogTag('yeah', 'yup', 'yeppers');
    const tag2 = new LogTag('yeah', 'yup', 'peppers');
    const tag3 = new LogTag('yeah', 'zup', 'yeppers');
    expect(tag1.equals(tag2)).toBeFalse();
    expect(tag1.equals(tag3)).toBeFalse();
  });

  test('does not equal an instance with different context with different length', () => {
    const tag1 = new LogTag('yeah', 'yup', 'yeppers', 'peppers');
    const tag2 = new LogTag('yeah', 'yup', 'yeppers');
    expect(tag1.equals(tag2)).toBeFalse();
    expect(tag2.equals(tag1)).toBeFalse();
  });
});

describe.each`
  label        | args       | expectColor
  ${'<empty>'} | ${[]}      | ${false}
  ${'false'}   | ${[false]} | ${false}
  ${'true'}    | ${[true]}  | ${true}
`('toHuman($label)', ({ args, expectColor }) => {
  function checkResult(tag, expected) {
    const got = tag.toHuman(...args);

    if (expectColor) {
      expect(got).not.toBe(expected);
      expect(stripAnsi(got)).toBe(expected);
    } else {
      expect(got).toBe(expected);
    }
  }

  test('works with just a main tag (no context strings)', () => {
    checkResult(
      new LogTag('justMain'),
      'justMain');
  });

  test('works with a single context string', () => {
    checkResult(
      new LogTag('mainAnd', 'one'),
      'mainAnd.one');
  });

  test('works with two context strings', () => {
    checkResult(
      new LogTag('oho', 'florp', 'zorp'),
      'oho.florp.zorp');
  });

  test('works with 10 context strings', () => {
    checkResult(
      new LogTag('whee', '1', '2', '3', '4', '5', '6', 'seven', '8', '9', 'ten'),
      'whee.1.2.3.4.5.6.seven.8.9.ten');
  });
});

describe('toHuman()', () => {
  test('does not get stuck on color vs. not (that is, no overzealous caching)', () => {
    const tag1    = new LogTag('oho', 'flop', 'zop');
    const expect1 = 'oho.flop.zop';
    expect(tag1.toHuman(false)).toBe(expect1);
    expect(tag1.toHuman(true)).not.toBe(expect1);

    const tag2    = new LogTag('aha', 'bloop', 'zoop', 'moop');
    const expect2 = 'aha.bloop.zoop.moop';
    expect(tag2.toHuman(true)).not.toBe(expect2);
    expect(tag2.toHuman(false)).toBe(expect2);
  });
});

describe('[BaseConverter.ENCODE]()', () => {
  const testOne = (...expected) => {
    const tag    = new LogTag(...expected);
    const result = tag[BaseConverter.ENCODE]();

    expect(result).toBeInstanceOf(Struct);
    expect(result.type).toBe(LogTag);
    expect(result.options).toStrictEqual({});
    expect(result.args).toStrictEqual(expected);
  };

  test('works with just a main tag (no context strings)', () => {
    testOne('simplyThis');
  });

  test('works with a single context string', () => {
    testOne('this', 'that');
  });

  test('works with two context strings', () => {
    testOne('this', 'and', 'more');
  });

  test('works with 10 context strings', () => {
    testOne('hey', 'one', 'two', '3', '4', '5', 'six', '7', '8', 'nine', '10');
  });
});

describe('withAddedContext()', () => {
  test('adds the indicated context', () => {
    const tag    = new LogTag('x', 'foo', 'bar');
    const result = tag.withAddedContext('zorch', 'florp');

    expect(result.context).toStrictEqual(['foo', 'bar', 'zorch', 'florp']);
  });
});
