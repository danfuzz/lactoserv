// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { JsonUtil } from '@this/net-util';

/**
 * Is `value` deep-frozen? **Note:** This only checks enumerable object
 * properties.
 *
 * @param {*} value The value in question
 * @returns {boolean} `true` iff `value` is deep-frozen.
 */
function isDeepFrozen(value) {
  switch (typeof value) {
    case 'function':
    case 'object': {
      if (!Object.isFrozen(value)) {
        return false;
      }

      for (const key in value) {
        if (!isDeepFrozen(value[key])) {
          return false;
        }
      }
    }
  }

  return true;
}

describe('parseAndFreeze()', () => {
  test.each`
  arg
  ${undefined}
  ${null}
  ${true}
  ${123}
  ${['x']}
  ${{ a: 'x' }}
  ${new Map()}
  `('rejects non-string argument: $arg', ({ arg }) => {
    expect(() => JsonUtil.parseAndFreeze(arg)).toThrow();
  });

  // Simple values
  test.each`
  arg
  ${'null'}
  ${'123'}
  ${'true'}
  ${'"blorp"'}
  `('converts simple value: $arg', ({ arg }) => {
    const expected = JSON.parse(arg);
    expect(JsonUtil.parseAndFreeze(arg)).toBe(expected);
  });

  // Compound values.
  test.each`
  arg
  ${'{}'}
  ${'[]'}
  ${'[123]'}
  ${'[123, []]'}
  ${'[123, [], [["a", "b"]], 456]'}
  ${'[{ "x": "y" }]'}
  ${'{ "a": "boop", "b": [1, 2, 3] }'}
  ${'{ "a": "boop", "b": { "c": ["d"] } }'}
  `('converts and freezes value: $arg', ({ arg }) => {
    const expected = JSON.parse(arg);
    const got      = JsonUtil.parseAndFreeze(arg);

    expect(got).toStrictEqual(expected);
    expect(isDeepFrozen(got)).toBeTrue();
  });
});
