// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import stripAnsi from 'strip-ansi';

import { Sexp } from '@this/decon';
import { LogPayload, LogTag } from '@this/loggy-intf';
import { Moment } from '@this/quant';
import { StackTrace } from '@this/valvis';


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

describe('deconstruct()', () => {
  test('produces an array of the constructor class and arguments', () => {
    const args    = [someStack, someMoment, someTag, 'whee', 10, 20, 'thirty'];
    const payload = new LogPayload(...args);
    const got     = payload.deconstruct();

    expect(got).toBeInstanceOf(Sexp);
    expect(got.toArray()).toStrictEqual([LogPayload, ...args]);
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

    const expected = "20240513-18:09:20.5432 some.tag yeah({ a: 10 }, [1, 2, 3], 'yes!')";
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

describe('toPlainObject()', () => {
  test('has the expected properties, set from the equivalent bits of the instance', () => {
    const payload = new LogPayload(
      someStack, someMoment, someTag, 'bonk', 123, { a: 10 }, ['x']);
    const got = payload.toPlainObject();

    expect(got).toContainAllKeys(['stack', 'when', 'tag', 'type', 'args']);
    expect(got.stack).toStrictEqual(someStack.frames);
    expect(got.when).toStrictEqual(someMoment.toPlainObject());
    expect(got.tag).toStrictEqual(someTag.allParts);
    expect(got.type).toBe('bonk');
    expect(got.args).toStrictEqual([123, { a: 10 }, ['x']]);
  });

  test('omits `stack` when `stack` is `null`', () => {
    const payload = new LogPayload(null, someMoment, someTag, 'bonk', 123);
    const got = payload.toPlainObject();

    expect(got).toContainAllKeys(['when', 'tag', 'type', 'args']);
  });

  test('includes `args` even when `args.length === 0`', () => {
    const payload = new LogPayload(someStack, someMoment, someTag, 'bonk');
    const got = payload.toPlainObject();

    expect(got).toContainAllKeys(['stack', 'when', 'tag', 'type', 'args']);
    expect(got.args).toStrictEqual([]);
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
