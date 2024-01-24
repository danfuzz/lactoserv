// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Cookies } from '@this/net-util';


describe('constructor', () => {
  test('does not throw', () => {
    expect(() => new Cookies()).not.toThrow();
  });
});

describe('.size', () => {
  test('is `0` for an empty instance', () => {
    expect(new Cookies().size).toBe(0);
  });

  test('is `10` for a size-10 instance', () => {
    const cookies = new Cookies();

    for (let i = 0; i < 10; i++) {
      cookies.set(`n${i}`, 'yeah');
    }

    expect(cookies.size).toBe(10);
  });
});

describe.each`
label          | method
${'entries()'} | ${'entries'}
${'iterator'}  | ${Symbol.iterator}
`('$label', ({ method }) => {
  test('works on an empty instance', () => {
    const cookies = new Cookies();
    const iter    = cookies[method]();

    expect(iter.next().done).toBeTrue();
  });

  test('works on a single-element instance', () => {
    const cookies = new Cookies();
    const name    = 'beep';
    const value   = 'boop';

    cookies.set(name, value);

    const iter   = cookies[method]();
    const result = iter.next();

    expect(iter.next().done).toBeTrue();
    expect(result.done).toBeFalsy();
    expect(result.value).toEqual([name, value]);

  });

  test('works on a two-element instance', () => {
    const cookies = new Cookies();
    const name1   = 'beep';
    const value1  = 'boop';
    const name2   = 'bink';
    const value2  = 'bonk';

    cookies.set(name1, value1);
    cookies.set(name2, value2);

    const iter   = cookies[method]();
    const result1 = iter.next();
    const result2 = iter.next();

    expect(iter.next().done).toBeTrue();
    expect(result1.done).toBeFalsy();
    expect(result2.done).toBeFalsy();
    expect([result1.value, result2.value]).toIncludeSameMembers(
      [[name1, value1], [name2, value2]]);
  });
});

describe('get()', () => {
  test('throws if a cookie is not found', () => {
    const cookies = new Cookies();

    expect(() => cookies.get('florp')).toThrow();
  });

  test('finds a cookie that was set', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value   = 'bloop';

    cookies.set(name, value);

    expect(cookies.get(name)).toBe(value);
  });
});

describe('getOrNull()', () => {
  test('returns `null` if a cookie is not found', () => {
    const cookies = new Cookies();

    expect(cookies.getOrNull('florp')).toBeNull();
  });

  test('finds a cookie that was set', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value   = 'bloop';

    cookies.set(name, value);

    expect(cookies.getOrNull(name)).toBe(value);
  });
});

describe('get()', () => {
  test('throws if a cookie is not found', () => {
    const cookies = new Cookies();

    expect(() => cookies.get('florp')).toThrow();
  });

  test('finds a cookie that was set', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value   = 'bloop';

    cookies.set(name, value);

    expect(cookies.get(name)).toBe(value);
  });
});

describe('set()', () => {
  describe('invalid names (not strings)', () => {
    test.each`
      arg
      ${undefined}
      ${null}
      ${false}
      ${1}
      ${[]}
      ${['x']}
    `('throws given $arg', ({ arg }) => {
      const cookies = new Cookies();
      expect(() => cookies.set(arg, 'beep')).toThrow();
    });
  });

  describe('invalid values (not strings)', () => {
    test.each`
      arg
      ${undefined}
      ${null}
      ${false}
      ${1}
      ${[]}
      ${['x']}
    `('throws given $arg', ({ arg }) => {
      const cookies = new Cookies();
      expect(() => cookies.set('x', arg)).toThrow();
    });
  });

  describe('syntactically incorrect names', () => {
    test.each`
      arg
      ${''}
      ${' '}
      ${','}
      ${';'}
      ${':'}
      ${'@'}
      ${'='}
      ${'<uh>'}
      ${'{wha}'}
      ${'(yeah)'}
      ${'[whee]'}
    `('throws given $arg', ({ arg }) => {
      const cookies = new Cookies();
      expect(() => cookies.set(arg, 'beep')).toThrow();
    });
  });

  describe('syntactically incorrect values', () => {
    test.each`
      arg
      ${' '}
      ${';'}
      ${'\\'}
      ${','}
      ${'"'}
      ${'"boop"'} // If passed with double quotes, the end result is de-quoted.
    `('throws given $arg', ({ arg }) => {
      const cookies = new Cookies();
      expect(() => cookies.set('x', arg)).toThrow();
    });
  });

  test('can set a not-yet-set cookie', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value   = 'bloop';

    cookies.set(name, value);
    expect(cookies.size).toBe(1);
  });

  test('can overwrite a cookie', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value1  = 'bloop';
    const value2  = 'bleep';

    cookies.set(name, value1);
    cookies.set(name, value2);
    expect(cookies.size).toBe(1);
    expect(cookies.get(name)).toBe(value2);
  });

  test('does not allow modification if the instance is frozen', () => {
    const cookies = new Cookies();

    Object.freeze(cookies);

    expect(() => cookies.set('x', 'y')).toThrow();
  });
});

describe('.EMPTY', () => {
  test('is an instance of the class', () => {
    expect(Cookies.EMPTY).toBeInstanceOf(Cookies);
  });

  test('has no elements', () => {
    expect(Cookies.EMPTY.size).toBe(0);
    expect([...Cookies.EMPTY]).toEqual([]);
  });

  test('is frozen', () => {
    expect(Cookies.EMPTY).toBeFrozen();
  });
});

describe('parse()', () => {
  test('returns `null` given an empty string', () => {
    expect(Cookies.parse('')).toBeNull();
  });

  test('returns `null` given just a space', () => {
    expect(Cookies.parse(' ')).toBeNull();
  });

  test('returns `null` given just a bunch of spaces', () => {
    expect(Cookies.parse('               ')).toBeNull();
  });

  describe('syntax errors without anything looking like an assignment', () => {
    test.each`
    input
    ${'x'}
    ${'beep'}
    ${'beep; boop'}
    ${'"x"'}
    ${'12312'}
    `('returns `null` given: $input', ({ input }) => {
      expect(Cookies.parse(input)).toBeNull();
    });
  });

  describe('syntax errors in the name', () => {
    test.each`
    name
    ${''}
    ${' '}
    ${'('}
    `('returns `null` given name: $name', ({ name }) => {
      expect(Cookies.parse(`${name}=boop`)).toBeNull();
    });
  });

  test('works for a single unquoted assignment', () => {
    const name    = 'blort';
    const value   = 'fleep';
    const cookies = Cookies.parse(`${name}=${value}`);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('works for a single quoted assignment', () => {
    const name    = 'blort';
    const value   = 'fleep';
    const cookies = Cookies.parse(`${name}="${value}"`);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('tolerates a leading space', () => {
    const name    = 'blort';
    const value   = 'fleep';
    const cookies = Cookies.parse(` ${name}=${value}`);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('tolerates a trailing space', () => {
    const name    = 'blort';
    const value   = 'fleep';
    const cookies = Cookies.parse(`${name}=${value} `);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('tolerates a leading semicolon', () => {
    const name    = 'blort';
    const value   = 'fleep';
    const cookies = Cookies.parse(`;${name}=${value}`);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('tolerates a trailing semicolon', () => {
    const name    = 'blort';
    const value   = 'fleep';
    const cookies = Cookies.parse(`${name}=${value};`);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('tolerates a leading semicolon-space', () => {
    const name    = 'blort';
    const value   = 'fleep';
    const cookies = Cookies.parse(`; ${name}=${value}`);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('tolerates a trailing semicolon-space', () => {
    const name    = 'blort';
    const value   = 'fleep';
    const cookies = Cookies.parse(`${name}=${value}; `);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('tolerates a leading recoverable syntax error', () => {
    const name    = 'blort';
    const value   = 'fleep';
    const cookies = Cookies.parse(`zonk; ${name}=${value}`);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('tolerates a trailing recoverable syntax error', () => {
    const name    = 'blort';
    const value   = 'fleep';
    const cookies = Cookies.parse(`${name}=${value}; 123!`);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('works for a two-unquoted-assignment instance', () => {
    const name1  = 'x123';
    const value1 = 'zongo';
    const name2  = 'beep';
    const value2 = 'zingo';
    const cookies = Cookies.parse(`${name1}=${value1}; ${name2}=${value2}`);

    expect([...cookies]).toIncludeSameMembers(
      [[name1, value1], [name2, value2]]);
  });

  test('works for a two-quoted-assignment instance', () => {
    const name1  = 'x123';
    const value1 = 'zongo';
    const name2  = 'beep';
    const value2 = 'zingo';
    const cookies = Cookies.parse(`${name1}="${value1}"; ${name2}="${value2}"`);

    expect([...cookies]).toIncludeSameMembers(
      [[name1, value1], [name2, value2]]);
  });

  test('decodes a syntactically correct quoted value', () => {
    const name    = 'yah';
    const value   = '!@#$%^&*()\u{27a1}\u{1f723}';
    const encVal  = encodeURIComponent(value);
    const cookies = Cookies.parse(`${name}="${encVal}"`);

    expect([...cookies]).toEqual([[name, value]]);
  });

  test('returns `null` given a syntactically incorrect quoted value', () => {
    const name    = 'yah';
    const value   = 'foo\\bar';
    const cookies = Cookies.parse(`${name}="${value}"`);

    expect(cookies).toBeNull();
  });

  test('skips a syntactically incorrect quoted value amongst two valid value', () => {
    const name1  = 'yup';
    const value1 = 'yeah';
    const name2  = 'whee';
    const value2 = 'alright';
    const cookies = Cookies.parse(`${name1}=${value1}; bloop="123%"; ${name2}="${value2}"`);

    expect([...cookies]).toIncludeSameMembers(
      [[name1, value1], [name2, value2]]);
  });
});
