// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import stripAnsi from 'strip-ansi';

import { BaseConverter, Sexp, StackTrace } from '@this/codec';
import { Moment } from '@this/data-values';
import { LogPayload, LogTag } from '@this/loggy-intf';


const someMoment = new Moment(123123123);
const someStack  = new StackTrace();
const someTag    = new LogTag('some', 'tag');

describe('constructor', () => {
  test('accepts valid arguments including `null` for `stack` and no `args`', () => {
    expect(() => new LogPayload(null, someMoment, someTag, 'whee'));
  });

  test('accepts valid arguments including non-`null` for `stack` and no `args`', () => {
    expect(() => new LogPayload(someStack, someMoment, someTag, 'whee'));
  });

  test('accepts multiple `args`', () => {
    expect(() => new LogPayload(someStack, someMoment, someTag, 'whee', 1, 2, 3, 4, 'five', ['six']));
  });
});

describe('[BaseConverter.ENCODE]()', () => {
  test('produces a `Sexp` with the constructor arguments as options', () => {
    const payload = new LogPayload(someStack, someMoment, someTag, 'whee', 10, 20, 'thirty');
    const got     = payload[BaseConverter.ENCODE]();

    expect(got).toBeInstanceOf(Sexp);
    expect(got.functor).toBe(LogPayload);
    expect(got.options).toEqual({
      stack: someStack,
      when:  someMoment,
      tag:   someTag,
      type:  'whee',
      args:  [10, 20, 'thirty']
    });
    expect(got.args).toEqual([]);
  });
});

describe('.stack', () => {
  test('is the `stack` passed in the constructor', () => {
    const got = new LogPayload(someStack, someMoment, someTag, 'whee');
    expect(got.stack).toBe(someStack);
  });
});

describe('.tag', () => {
  test('is the `tag` passed in the constructor', () => {
    const got = new LogPayload(someStack, someMoment, someTag, 'whee');
    expect(got.tag).toBe(someTag);
  });
});

describe('.when', () => {
  test('is the `when` passed in the constructor', () => {
    const got = new LogPayload(someStack, someMoment, someTag, 'whee');
    expect(got.when).toBe(someMoment);
  });
});

describe('toHuman()', () => {
  function doTest(...args) {
    const payload = new LogPayload(
      someStack, new Moment(1715623760.5432), someTag, 'yeah', { a: 10 },
      [1, 2, 3], 'yes!');

    const expected = "20240513-18:09:20.5432 some.tag yeah({ a: 10 }, [ 1, 2, 3 ], 'yes!')";
    const got      = payload.toHuman(...args);

    if (args[0] === true) {
      expect(got).not.toBe(expected); // Because it should be colorized.
      expect(stripAnsi(got)).toBe(expected);
    } else {
      expect(got).toBe(expected);
    }
  }

  describe('with `colorize === false`', () => {
    test('works as expected on an example payload', () => {
      doTest();
      doTest(false);
    });
  });

  describe('with `colorize === true`', () => {
    test('works as expected on an example payload', () => {
      doTest(true);
    });
  });
});

//
// Static members
//

describe('makeKickoffInstance()', () => {
  test('has the expected properties', () => {
    const got = LogPayload.makeKickoffInstance();
    expect(got.stack).toBeNull();
    expect(got.when.atSec).toBe(0);
    expect(got.tag.main).toBe('kickoff');
    expect(got.tag.context).toBeArrayOfSize(0);
    expect(got.type).toBe('kickoff');
  });
});
