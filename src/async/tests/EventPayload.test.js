// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventPayload } from '@this/async';


describe('constructor()', () => {
  test.each`
  type
  ${undefined}
  ${null}
  ${true}
  ${1234.56}
  ${['x']}
  ${{ a: 'boop' }}
  ${new Map()}
  `('throws given `$type` for `type`', ({ type }) => {
    expect(() => new EventPayload(type)).toThrow();
  });

  test.each`
  type
  ${''}
  ${'a'}
  ${'blorp'}
  `('accepts `\'$type\'` for `type`', ({ type }) => {
    expect(() => new EventPayload(type)).not.toThrow();
  });

  test.each`
  count
  ${0}
  ${1}
  ${2}
  ${20}
  `('accepts $count arguments', ({ count }) => {
    const args = Array(count).fill('boop');
    expect(() => new EventPayload('x', ...args)).not.toThrow();
  });
});

describe('.args', () => {
  test('has the same contents as the `args` passed in the constructor', () => {
    const args = ['beep', 123, { a: 'zonk' }];
    const got  = new EventPayload('x', ...args);

    expect(got.args).toEqual(args);
    expect(got.args[2]).toBe(args[2]);
  });

  test('is frozen', () => {
    const got1 = new EventPayload('x');
    const got2 = new EventPayload('x', 1, 2, 3, 'zonk');

    expect(got1.args).toBeFrozen();
    expect(got2.args).toBeFrozen();
  });
});

describe('.type', () => {
  test('is the same value as was passed in the constructor', () => {
    const type = 'blonk';
    const got  = new EventPayload(type, 1, 2, 3);

    expect(got.type).toBe(type);
  });
});


//
// Static members
//

describe('makeKickoffInstance()', () => {
  describe.each`
  args         | expectType
  ${[]}        | ${'kickoff'}
  ${[null]}    | ${'kickoff'}
  ${['florp']} | ${'florp'}
  `('with arguments: $args', ({ args, expectType }) => {
    test('produces an instance with empty `args`', () => {
      const got = EventPayload.makeKickoffInstance(...args);
      expect(got.args).toBeArrayOfSize(0);
    });

    test(`has \`type === '${expectType}'\``, () => {
      const got = EventPayload.makeKickoffInstance(...args);
      expect(got.type).toBe(expectType);
    });
  });
});
