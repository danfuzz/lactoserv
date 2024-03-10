// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Duration, Moment } from '@this/data-values';
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
label                  | method                | yields
${'entries()'}         | ${'entries'}          | ${'entry'}
${'iterator'}          | ${Symbol.iterator}    | ${'entry'}
${'attributeSets()'}   | ${'attributeSets'}    | ${'attrib'}
${'responseHeaders()'} | ${'responseHeaders'}  | ${'header'}
`('$label', ({ method, yields }) => {
  function expectedFor(name, value, attribs = {}) {
    switch (yields) {
      case 'attrib': { return { name, value, ...attribs }; }
      case 'entry':  { return [name, value]; }
      case 'header': { return Cookies.responseHeaderFrom({ name, value, ...attribs }); }
    }
    throw new Error('Shouldn\'t happen.'); // Need to add a case if we see this.
  }

  test('works on an empty instance', () => {
    const cookies = new Cookies();
    const iter    = cookies[method]();

    expect(iter.next()).toEqual({ done: true });
  });

  test('works on a single-element instance', () => {
    const cookies = new Cookies();
    const val1    = ['beep', 'boop', { partitioned: true }];

    cookies.set(...val1);

    const iter   = cookies[method]();
    const result = iter.next();

    expect(iter.next()).toEqual({ done: true });
    expect(result.done).toBeFalsy();
    expect(result.value).toEqual(expectedFor(...val1));
  });

  test('works on a two-element instance', () => {
    const cookies = new Cookies();
    const val1    = ['beep', 'boop'];
    const val2    = ['flip', 'florp', { httpOnly: true, domain: 'x.y.z' }];

    cookies.set(...val1);
    cookies.set(...val2);

    const iter    = cookies[method]();
    const result1 = iter.next();
    const result2 = iter.next();

    expect(iter.next()).toEqual({ done: true });
    expect(result1.done).toBeFalsy();
    expect(result2.done).toBeFalsy();
    expect([result1.value, result2.value]).toIncludeSameMembers([
      expectedFor(...val1),
      expectedFor(...val2)]);
  });
});

describe('getAttributes()', () => {
  test('throws if a cookie is not found', () => {
    const cookies = new Cookies();

    expect(() => cookies.getAttributes('florp')).toThrow();
  });

  test('finds a cookie that was set', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value   = 'bloop';
    const att     = { domain: 'florp.fleep', path: '/' };

    cookies.set(name, value, att);

    expect(cookies.getAttributes(name)).toEqual({
      name,
      value,
      ...att
    });
  });

  test('when non-null, returns a frozen instance', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value   = 'bloop';
    const att     = { domain: 'florp.fleep', path: '/' };

    cookies.set(name, value, att);

    expect(cookies.getAttributes(name)).toBeFrozen();
  });
});

describe('getAttributesOrNull()', () => {
  test('returns `null` if a cookie is not found', () => {
    const cookies = new Cookies();

    expect(cookies.getAttributesOrNull('florp')).toBeNull();
  });

  test('finds a cookie that was set', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value   = 'bloop';
    const att     = { domain: 'florp.fleep', path: '/' };

    cookies.set(name, value, att);

    expect(cookies.getAttributesOrNull(name)).toEqual({
      name,
      value,
      ...att
    });
  });

  test('when non-null, returns a frozen instance', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value   = 'bloop';
    const att     = { domain: 'florp.fleep', path: '/' };

    cookies.set(name, value, att);

    expect(cookies.getAttributesOrNull(name)).toBeFrozen();
  });
});

describe('getValue()', () => {
  test('throws if a cookie is not found', () => {
    const cookies = new Cookies();

    expect(() => cookies.getValue('florp')).toThrow();
  });

  test('finds a cookie that was set', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value   = 'bloop';

    cookies.set(name, value);

    expect(cookies.getValue(name)).toBe(value);
  });
});

describe('getValueOrNull()', () => {
  test('returns `null` if a cookie is not found', () => {
    const cookies = new Cookies();

    expect(cookies.getValueOrNull('florp')).toBeNull();
  });

  test('finds a cookie that was set', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value   = 'bloop';

    cookies.set(name, value);

    expect(cookies.getValueOrNull(name)).toBe(value);
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

  describe('invalid attributes', () => {
    test.each`
      arg
      ${false}
      ${'boop'}
      ${123}
      ${[{ secure: true }]}
      ${{ name: 'x' }}
      ${{ value: 'x' }}
      ${{ bloop: 'x' }}
      ${{ domain: true }}
      ${{ domain: 123 }}
      ${{ expires: true }}
      ${{ expires: 123 }}
      ${{ expires: 'boop' }}
      ${{ expires: new Date(123) }}
      ${{ httpOnly: 123 }}
      ${{ httpOnly: 'boop' }}
      ${{ maxAge: true }}
      ${{ maxAge: 123 }}
      ${{ maxAge: 'boop' }}
      ${{ partitioned: 123 }}
      ${{ partitioned: 'boop' }}
      ${{ path: true }}
      ${{ path: 123 }}
      ${{ sameSite: true }}
      ${{ sameSite: 123 }}
      ${{ sameSite: 'boop' }}
      ${{ secure: 123 }}
      ${{ secure: 'boop' }}
    `('throws given $arg', ({ arg }) => {
      const cookies = new Cookies();
      expect(() => cookies.set('x', 'y', arg)).toThrow();
    });
  });

  test('can set a not-yet-set cookie', () => {
    const cookies = new Cookies();

    cookies.set('x', 'y');
    expect(cookies.size).toBe(1);

    cookies.set('a', 'b', { path: '/' });
    expect(cookies.size).toBe(2);
  });

  test('can overwrite a cookie', () => {
    const cookies = new Cookies();
    const name    = 'florp';
    const value1  = 'bloop';
    const value2  = 'bleep';
    const att1    = { path: '/' };
    const att2    = { httpOnly: true };

    cookies.set(name, value1, att1);
    cookies.set(name, value2, att2);
    expect(cookies.size).toBe(1);
    expect(cookies.getValue(name)).toBe(value2);
    expect(cookies.getAttributes(name)).toEqual({
      name,
      value: value2,
      ...att2
    });
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
  function prefixSuffixTest(prefix, suffix) {
    const name      = 'blort';
    const value     = 'fleep';
    const cUnquoted = Cookies.parse(`${prefix}${name}=${value}${suffix}`);
    const cQuoted   = Cookies.parse(`${prefix}${name}="${value}"${suffix}`);

    expect([...cUnquoted]).toEqual([[name, value]]);
    expect([...cQuoted]).toEqual([[name, value]]);
  }

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
    prefixSuffixTest(' ', '');
  });

  test('tolerates a trailing space', () => {
    prefixSuffixTest('', ' ');
  });

  test('tolerates a leading semicolon', () => {
    prefixSuffixTest(';', '');
  });

  test('tolerates a trailing semicolon', () => {
    prefixSuffixTest('', ';');
  });

  test('tolerates a leading semicolon-space', () => {
    prefixSuffixTest('; ', '');
  });

  test('tolerates a trailing semicolon-space', () => {
    prefixSuffixTest('', '; ');
  });

  test('tolerates a leading space-semicolon', () => {
    prefixSuffixTest(' ;', '');
  });

  test('tolerates a trailing space-semicolon', () => {
    prefixSuffixTest('', ' ;');
  });

  test('tolerates a leading recoverable syntax error', () => {
    prefixSuffixTest('zonk; ', '');
    prefixSuffixTest('@# ', '');
  });

  test('tolerates a trailing recoverable syntax error', () => {
    prefixSuffixTest('', '; 123!');
    prefixSuffixTest('', '; ()*  ');
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
    const encVal  = encodeURI(value);
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

describe('responseHeaderFrom()', () => {
  test.each`
  attribs | expected
  --
  ${{
    name:  'x',
    value: 'y'
  }}
  ${'x=y'}
  --
  ${{
    name: 'blort',
    value: 'beep/florp!'
  }}
  ${'blort=beep/florp!'}
  --
  ${{
    name: 'blort',
    value: 'a b c'
  }}
  ${'blort=a%20b%20c'}
  --
  ${{
    name:   'a',
    value:  'b',
    domain: 'beep.boop'
  }}
  ${'a=b; Domain=beep.boop'}
  --
  ${{
    name:    'a',
    value:   'b',
    expires: Moment.fromMsec(Date.UTC(2020, 0, 1, 2, 3, 4))
  }}
  ${'a=b; Expires=Wed, 01 Jan 2020 02:03:04 GMT'}
  --
  ${{
    name:     'a',
    value:    'b',
    httpOnly: true
  }}
  ${'a=b; HttpOnly'}
  --
  ${{
    name:  'a',
    value: 'b',
    maxAge: new Duration(12345)
  }}
  ${'a=b; Max-Age=12345'}
  --
  ${{
    name:  'a',
    value: 'b',
    maxAge: new Duration(12.987)
  }}
  ${'a=b; Max-Age=12'}
  --
  ${{
    name:        'a',
    value:       'b',
    partitioned: true
  }}
  ${'a=b; Partitioned'}
  --
  ${{
    name:  'a',
    value: 'b',
    path:  '/beep/boop'
  }}
  ${'a=b; Path=/beep/boop'}
  --
  ${{
    name:     'a',
    value:    'b',
    sameSite: 'strict'
  }}
  ${'a=b; SameSite=Strict'}
  --
  ${{
    name:   'a',
    value:  'b',
    secure: true
  }}
  ${'a=b; Secure'}
  --
  ${{
    name:     'a',
    value:    'b',
    // This is a standard combo.
    sameSite: 'none',
    secure:   true
  }}
  ${'a=b; SameSite=None; Secure'}
  --
  ${{
    name:        'a',
    value:       'b',
    domain:      'zip.zap.zoop',
    expires:     Moment.fromMsec(Date.UTC(2069, 8, 7, 6, 55, 44)),
    httpOnly:    true,
    maxAge:      new Duration(987654321),
    partitioned: true,
    path:        '/a/bb/ccc',
    sameSite:    'lax',
    secure:      true
  }}
  ${
    'a=b; Domain=zip.zap.zoop; Expires=Sat, 07 Sep 2069 06:55:44 GMT; ' +
    'HttpOnly; Max-Age=987654321; Partitioned; Path=/a/bb/ccc; SameSite=Lax; ' +
    'Secure'
  }
  `('works for: $attribs', ({ attribs, expected }) => {
    expect(Cookies.responseHeaderFrom(attribs)).toBe(expected);
  });
});
