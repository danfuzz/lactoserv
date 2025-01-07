// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConfig } from '@this/structy';


class SomeConfig extends BaseConfig {
  _config_abc(value = 'xyz') {
    return value;
  }

  _config_florp(value) {
    if (typeof value !== 'number') {
      throw new Error('Not a number!');
    } else {
      return value;
    }
  }
}

describe('constructor()', () => {
  test('accepts an argument with no `class`', () => {
    const conf = new BaseConfig({});
    expect(conf.class === null);
  });

  test('accepts `class === null`', () => {
    const conf = new BaseConfig({ class: null });
    expect(conf.class === null);
  });

  test('accepts a (non-modern) constructor function for `class`', () => {
    const conf = new BaseConfig({ class: Map });
    expect(conf.class === Map);
  });

  test('accepts a (modern) class for `class`', () => {
    class SomeClass { /*empty*/ }
    const conf = new BaseConfig({ class: SomeClass });
    expect(conf.class === SomeClass);
  });
});

describe('_impl_propertyPrefix()', () => {
  test('is `config`', () => {
    const conf = new BaseConfig({});
    expect(conf._impl_propertyPrefix()).toBe('config');
  });
});

describe('eval()', () => {
  test('works in a simple case (smoke test)', () => {
    const expected = { class: Map, abc: 'xyz', florp: 987 };
    const conf     = SomeConfig.eval({ florp: 987 }, { targetClass: Map });
    expect(conf).toBeInstanceOf(SomeConfig);
    expect({ ...conf }).toStrictEqual(expected);
  });

  test('throws when `targetClass === null` but in the result `class !== null`', () => {
    const raw  = { class: Map };
    const opts = { targetClass: null };

    expect (() => BaseConfig.eval(raw, opts)).toThrow(/expected null, got Map/);
  });

  test('throws when `targetClass !== null` but in the result `class === null`', () => {
    const raw  = { class: null };
    const opts = { targetClass: Map };

    expect (() => BaseConfig.eval(raw, opts)).toThrow(/expected Map, got null/);
  });

  test('throws when `targetClass !== result.class` and neither is `null`', () => {
    const raw  = { class: Map };
    const opts = { targetClass: Set };

    expect (() => BaseConfig.eval(raw, opts)).toThrow(/expected Set, got Map/);
  });

  test('throws when `targetClass` is not a class, function or `null`', () => {
    const opts = { targetClass: 'boop' };

    expect (() => BaseConfig.eval({}, opts)).toThrow(/constructor function.*class/);
  });
});
