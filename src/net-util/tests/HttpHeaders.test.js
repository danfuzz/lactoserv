// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Cookies, HttpHeaders } from '@this/net-util';


describe('constructor', () => {
  describe('given no arguments', () => {
    test('doesn\'t throw', () => {
      expect(() => new HttpHeaders()).not.toThrow();
    });

    test('constructs a subclass of `Headers`', () => {
      expect(new HttpHeaders()).toBeInstanceOf(Headers);
    });

    test('has no entries', () => {
      const hh = new HttpHeaders();
      expect([...hh]).toEqual([]);
    });
  });
});

// This tests the constructor and methods in terms of modifying an initially
// empty instance.
describe.each`
label            | methodName
${'constructor'} | ${'constructor'}
${'appendAll()'} | ${'appendAll'}
${'setAll()'}    | ${'setAll'}
`('$label', ({ methodName }) => {
  function prep(arg) {
    if (methodName === 'constructor') {
      return new HttpHeaders(arg);
    } else {
      const hh = new HttpHeaders();
      hh[methodName](arg);
      return hh;
    }
  }

  const aPlainObj1 = { foo: 'bar', 'florp': ['um', 'yeah'] };
  const aMap1      = new Map([['foo', 'bar'], ['florp', 'um, yeah']]);
  const aHeaders1  = new Headers();
  const anotherHH1 = new HttpHeaders();

  aHeaders1.append('foo', 'bar');
  aHeaders1.append('florp', 'um');
  aHeaders1.append('florp', 'yeah');

  anotherHH1.append('foo', 'bar');
  anotherHH1.append('florp', 'um');
  anotherHH1.append('florp', 'yeah');

  const aPlainObj2 = { 'set-cookie': ['x=1', 'y=2'] };
  const aMap2      = new Map([['set-cookie', ['x=1', 'y=2']]]);
  const aHeaders2  = new Headers();
  const anotherHH2 = new HttpHeaders();

  aHeaders2.append('set-cookie', 'x=1');
  aHeaders2.append('set-cookie', 'y=2');

  anotherHH2.append('set-cookie', 'x=1');
  anotherHH2.append('set-cookie', 'y=2');

  describe.each`
  label                      | arg1          | arg2
  ${'a plain object'}        | ${aPlainObj1} | ${aPlainObj2}
  ${'a Map'}                 | ${aMap1}      | ${aMap2}
  ${'a `Headers` per se'}    | ${aHeaders1}  | ${aHeaders2}
  ${'another `HttpHeaders`'} | ${anotherHH1} | ${anotherHH2}
  `('given $label', ({ arg1, arg2 }) => {
    test('includes its elements', () => {
      const hh = prep(arg1);
      expect([...hh]).toIncludeSameMembers([['foo', 'bar'], ['florp', 'um, yeah']]);
    });

    test('works given multiple `set-cookie`s', () => {
      const hh = prep(arg2);
      expect([...hh]).toEqual([['set-cookie', 'x=1'], ['set-cookie', 'y=2']]);
      expect(hh.getSetCookie()).toIncludeSameMembers(['x=1', 'y=2']);
    });
  });

  test('includes all values in an array', () => {
    const hh = prep({ 'foo': ['bar', 'baz'] });
    expect([...hh]).toEqual([['foo', 'bar, baz']]);
  });

  test('includes all values from multiple entries with the same name', () => {
    const hh = prep([['foo', 'bar'], ['foo', 'baz']]);
    expect([...hh]).toEqual([['foo', 'bar, baz']]);
  });
});

describe('appendAll()', () => {
  test('sets a non-existent name to a single given value', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.appendAll({ 'x': 'y' });

    expect([...hh]).toIncludeSameMembers([['a', 'b'], ['x', 'y']]);
  });

  test('sets a non-existent name to multiple given values', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.appendAll({ 'x': ['y', 'z'] });

    expect([...hh]).toIncludeSameMembers([['a', 'b'], ['x', 'y, z']]);
  });

  test('appends a single value to a pre-existing name', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.set('x', 'y');
    hh.appendAll({ 'x': 'z' });

    expect([...hh]).toIncludeSameMembers([['a', 'b'], ['x', 'y, z']]);
  });

  test('appends multiple values to a pre-existing name', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.set('x', 'y');
    hh.append('x', 'z');
    hh.appendAll({ 'x': ['z1', 'z2'] });

    expect([...hh]).toIncludeSameMembers([
      ['a', 'b'], ['x', 'y, z, z1, z2']
    ]);
  });

  test('appends multiple `set-cookies` from a plain object', () => {
    const hh = new HttpHeaders();

    hh.set('set-cookie', 'a=1');
    hh.appendAll({ 'set-cookie': ['b=2', 'c=3'] });

    expect([...hh]).toIncludeSameMembers([
      ['set-cookie', 'a=1'],
      ['set-cookie', 'b=2'],
      ['set-cookie', 'c=3']
    ]);
  });

  test('appends multiple `set-cookies` from a `Headers`', () => {
    const hh   = new HttpHeaders();
    const orig = new Headers();

    hh.set('set-cookie', 'a=1');
    orig.append('set-cookie', 'b=2');
    orig.append('set-cookie', 'c=3');
    hh.appendAll(orig);

    expect([...hh]).toIncludeSameMembers([
      ['set-cookie', 'a=1'],
      ['set-cookie', 'b=2'],
      ['set-cookie', 'c=3']
    ]);
  });

  test('uses an underlay function when it would not add to a pre-existing header', () => {
    const hh = new HttpHeaders();

    hh.appendAll({ 'blorp': () => 'beep-boop' });

    expect([...hh]).toEqual([['blorp', 'beep-boop']]);
  });

  test('does not use the underlay function when it would add to a pre-existing header', () => {
    const hh            = new HttpHeaders();
    let   overlayCalled = false;

    hh.set('foo', 'bar');

    hh.appendAll({
      'foo': () => {
        overlayCalled = true;
        return 'beeeeeeeep!!!!!';
      }
    });

    expect([...hh]).toEqual([['foo', 'bar']]);
    expect(overlayCalled).toBeFalse();
  });

  test('uses multiple underlay functions when they would not add to a pre-existing header', () => {
    const hh = new HttpHeaders();

    // This tests multiple entries with the same name.
    hh.appendAll([['blorp', () => 'beep1'], ['blorp', () => 'beep2']]);

    // This tests a single array entry binding to an array of functions.
    hh.appendAll({ zorch: [() => 'zonk1', () => 'zonk2'] });

    expect([...hh]).toIncludeSameMembers([
      ['blorp', 'beep1, beep2'],
      ['zorch', 'zonk1, zonk2']
    ]);
  });
});

describe('appendSetCookie()', () => {
  test('appends a single cookie', () => {
    const cookies = new Cookies();
    const hh      = new HttpHeaders();

    cookies.set('beep', 'boop', { httpOnly: true });
    hh.appendSetCookie(cookies);

    expect([...hh]).toEqual([['set-cookie', 'beep=boop; HttpOnly']]);
  });

  test('appends two cookies', () => {
    const cookies = new Cookies();
    const hh      = new HttpHeaders();

    cookies.set('beep', 'boop', { httpOnly: true });
    cookies.set('fleep', 'floop', { secure: true });
    hh.appendSetCookie(cookies);

    expect([...hh]).toIncludeSameMembers([
      ['set-cookie', 'beep=boop; HttpOnly'],
      ['set-cookie', 'fleep=floop; Secure']
    ]);
  });
});

describe('entriesForVersion()', () => {
  test.each`
  label             | arg
  ${'string `0.9`'} | ${'0.9'}
  ${'string `1.0`'} | ${'1.0'}
  ${'string `1.1`'} | ${'1.1'}
  ${'number `0`'}   | ${0}
  ${'number `1`'}   | ${1}
  `('returns classic names given $label', ({ arg }) => {
    const hh = new HttpHeaders({
      'beep-BOOP':  ['10', '20'],
      'EtAg':       '"zonk"',
      'SET-cookie': ['a=123', 'b=456']
    });

    expect([...(hh.entriesForVersion(arg))]).toIncludeSameMembers([
      ['Beep-Boop',  '10, 20'],
      ['ETag',       '"zonk"'],
      ['Set-Cookie', ['a=123', 'b=456']]
    ]);
  });

  test.each`
  label             | arg
  ${'string `2.0`'} | ${'2.0'}
  ${'string `2.1`'} | ${'2.1'}
  ${'number `2`'}   | ${2}
  ${'number `3`'}   | ${3}
  `('returns modern names given $label', ({ arg }) => {
    const hh = new HttpHeaders({
      'beep-BOOP':  ['10', '20'],
      'EtAg':       '"zonk"',
      'SET-cookie': ['a=123', 'b=456']
    });

    expect([...(hh.entriesForVersion(arg))]).toIncludeSameMembers([
      ['beep-boop',  '10, 20'],
      ['etag',       '"zonk"'],
      ['set-cookie', ['a=123', 'b=456']]
    ]);
  });
});

describe('extract()', () => {
  test('tolerates all not-found names', () => {
    const hh = new HttpHeaders();

    hh.set('foo', 'bar');

    expect(hh.extract('a', 'b', 'zzz')).toEqual({});
  });

  test('tolerates some but not all not-found names', () => {
    const hh = new HttpHeaders();

    hh.set('foo', 'bar');

    expect(hh.extract('a', 'foo', 'b')).toEqual({ foo: 'bar' });
  });

  test('extracts a single `set-cookies` as an array', () => {
    const hh = new HttpHeaders();

    hh.set('set-cookie', 'a=b');

    expect(hh.extract('set-cookie')).toEqual({ 'set-cookie': ['a=b'] });
  });

  test('extracts multiple `set-cookies` as an array', () => {
    const hh = new HttpHeaders();

    hh.set('set-cookie', 'a=b');
    hh.append('set-cookie', 'c=d');

    expect(hh.extract('set-cookie')).toEqual({ 'set-cookie': ['a=b', 'c=d'] });
  });

  test('preserves case of extracted result', () => {
    const hh = new HttpHeaders();

    hh.set('FOO', 'bar');
    hh.set('SET-COOKIE', 'a=b');

    expect(hh.extract('Set-Cookie', 'Foo', 'foo', 'FOO')).toEqual({
      'Set-Cookie': ['a=b'],
      'Foo': 'bar',
      'foo': 'bar',
      'FOO': 'bar'
    });
  });
});

describe.each`
methodName
${'hasAll'}
${'hasAny'}
`('$methodName()', ({ methodName }) => {
  test.each`
  args                            | expectHasAll | expectHasAny
  ${[]}                           | ${true}      | ${false}
  ${['nopers']}                   | ${false}     | ${false}
  ${['really-no', 'nopers']}      | ${false}     | ${false}
  ${['a']}                        | ${true}      | ${true}
  ${['a', 'b']}                   | ${true}      | ${true}
  ${['set-cookie']}               | ${true}      | ${true}
  ${['set-cookie', 'zorch', 'b']} | ${true}      | ${true}
  ${['a', 'nope']}                | ${false}     | ${true}
  ${['nope', 'a']}                | ${false}     | ${true}
  ${['nope', 'a', 'zilch']}       | ${false}     | ${true}
  ${['set-cookie', 'no']}         | ${false}     | ${true}
  ${['no', 'set-cookie']}         | ${false}     | ${true}
  `('works for: $args', ({ args, expectHasAll, expectHasAny }) => {
    const expected = (methodName === 'hasAll') ? expectHasAll : expectHasAny;
    const hh = new HttpHeaders({
      'a': 'yes',
      'b': ['yeppers', 'yeah'],
      'set-cookie': ['x=oh', 'y=yes', 'z=really'],
      'zorch': 'splat'
    });

    expect(hh[methodName](...args)).toBe(expected);
  });
});

describe('setAll()', () => {
  test('sets a non-existent name to a single given value', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.setAll({ 'x': 'y' });

    expect([...hh]).toIncludeSameMembers([['a', 'b'], ['x', 'y']]);
  });

  test('sets a non-existent name to multiple given values', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.setAll({ 'x': ['y', 'z'] });

    expect([...hh]).toIncludeSameMembers([['a', 'b'], ['x', 'y, z']]);
  });

  test('replaces a pre-existing name with a single value', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.set('x', 'y');
    hh.setAll({ 'x': 'z' });

    expect([...hh]).toIncludeSameMembers([['a', 'b'], ['x', 'z']]);
  });

  test('replaces a pre-existing name with multiple values', () => {
    const hh = new HttpHeaders();

    hh.set('a', 'b');
    hh.set('x', 'y');
    hh.append('x', 'z');
    hh.setAll({ 'x': ['z1', 'z2'] });

    expect([...hh]).toIncludeSameMembers([
      ['a', 'b'], ['x', 'z1, z2']
    ]);
  });

  test('sets multiple `set-cookies` from a plain object', () => {
    const hh = new HttpHeaders();

    hh.set('set-cookie', 'a=1');
    hh.setAll({ 'set-cookie': ['b=2', 'c=3'] });

    expect([...hh]).toIncludeSameMembers([
      ['set-cookie', 'b=2'],
      ['set-cookie', 'c=3']
    ]);
  });

  test('sets multiple `set-cookies` from a `Headers`', () => {
    const hh   = new HttpHeaders();
    const orig = new Headers();

    hh.set('set-cookie', 'a=1');
    orig.append('set-cookie', 'b=2');
    orig.append('set-cookie', 'c=3');
    hh.setAll(orig);

    expect([...hh]).toIncludeSameMembers([
      ['set-cookie', 'b=2'],
      ['set-cookie', 'c=3']
    ]);
  });

  test('uses an underlay function when it would not replace to a pre-existing header', () => {
    const hh = new HttpHeaders();

    hh.setAll({ 'blorp': () => 'beep-boop' });

    expect([...hh]).toEqual([['blorp', 'beep-boop']]);
  });

  test('does not use the underlay function when it would replace a pre-existing header', () => {
    const hh            = new HttpHeaders();
    let   overlayCalled = false;

    hh.set('foo', 'bar');

    hh.setAll({
      'foo': () => {
        overlayCalled = true;
        return 'beeeeeeeep!!!!!';
      }
    });

    expect([...hh]).toEqual([['foo', 'bar']]);
    expect(overlayCalled).toBeFalse();
  });

  test('uses multiple underlay functions when they would not replace a pre-existing header', () => {
    const hh = new HttpHeaders();

    // This tests multiple entries with the same name.
    hh.setAll([['blorp', () => 'beep1'], ['blorp', () => 'beep2']]);

    // This tests a single array entry binding to an array of functions.
    hh.setAll({ zorch: [() => 'zonk1', () => 'zonk2'] });

    expect([...hh]).toIncludeSameMembers([
      ['blorp', 'beep1, beep2'],
      ['zorch', 'zonk1, zonk2']
    ]);
  });
});
