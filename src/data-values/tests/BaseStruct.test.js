// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseStruct } from '@this/data-values';

/**
 * Checks an instance to see if it has the expected properties.
 *
 * @param {*} instance The instance.
 * @param {function(new:BaseStruct)} cls Its expected class.
 * @param {object} expected The expected properties.
 */
function expectResult(instance, cls, expected) {
  expect(instance).toBeInstanceOf(BaseStruct);
  expect(instance.constructor).toBe(cls);

  expect({ ...instance }).toEqual(expected);

  const props = Object.getOwnPropertyDescriptors(instance);
  for (const [name, desc] of Object.entries(props)) {
    expect(name in instance).toBeTrue();
    expect(desc).toEqual({
      value:        instance[name],
      writable:     false,
      configurable: false,
      enumerable:   true
    });
  }
}


describe('using the (base) class directly', () => {
  describe('constructor()', () => {
    describe.each`
    args
    ${[]}
    ${[undefined]}
    ${[null]}
    ${[{}]}
    `('given args $args', ({ args }) => {
      test('does not throw', () => {
        expect(() => new BaseStruct(...args)).not.toThrow();
      });

      test('produces an instance with no extra properties', () => {
        const instance = new BaseStruct(...args);
        const props    = Object.getOwnPropertyNames(instance);
        expect(props).toEqual([]);
      });
    });

    test.each`
    arg
    ${false}
    ${123}
    ${'abc'}
    ${[1]}
    ${new Map()}
    `('throws given invalid argument $arg', ({ arg }) => {
      expect(() => new BaseStruct(arg)).toThrow();
    });

    test('throws given a non-empty plain object', () => {
      // ...because the base class doesn't define any properties.
      expect(() => new BaseStruct({ what: 'nope' })).toThrow(/Extra property/);
    });
  });

  describe('_impl_propertyPrefix', () => {
    test('is `struct`', () => {
      const instance = new BaseStruct();

      // eslint-disable-next-line no-restricted-syntax
      expect(instance._impl_propertyPrefix()).toBe('struct');
    });
  });

  describe('_impl_validate', () => {
    test('returns its argument', () => {
      const instance = new BaseStruct();
      const someObj  = { a: 'bcd' };

      // eslint-disable-next-line no-restricted-syntax
      expect(instance._impl_validate(someObj)).toBe(someObj);
    });
  });

  //
  // Static members
  //

  describe('eval()', () => {
    describe('given no `defaults`', () => {
      test('given a direct instance of this class, returns it', () => {
        const instance = new BaseStruct();
        expect(BaseStruct.eval(instance)).toBe(instance);
      });

      test('given an instance of a subclass, returns it', () => {
        class SomeStruct extends BaseStruct {
          // @emptyBlock
        }

        const instance = new SomeStruct();
        expect(BaseStruct.eval(instance)).toBe(instance);
      });

      test.each`
      arg
      ${undefined}
      ${null}
      ${{}}
      `('given empty-ish argument $arg, returns an empty instance', ({ arg }) => {
        const instance = BaseStruct.eval(arg);
        const props    = Object.getOwnPropertyNames(instance);
        expect(props).toEqual([]);
      });

      test('throws given an instance of a non-struct class (which isn\'t a plain object)', () => {
        expect(() => BaseStruct.eval(new Map())).toThrow();
        expect(() => BaseStruct.eval([])).toThrow();
      });

      test.each`
      arg
      ${false}
      ${true}
      ${12345}
      ${12345n}
      ${'florp'}
      ${Symbol('beep')}
      `('throws given non-object $arg', ({ arg }) => {
        expect(() => BaseStruct.eval(arg)).toThrow();
      });

      test('throws given a plain object with any bindings', () => {
        // ...because the base class doesn't define any properties.
        expect(() => BaseStruct.eval({ beep: 'boop' })).toThrow();
      });
    });
  });

  describe('given `defaults`', () => {
    test('works given an empty argument and empty `defaults`', () => {
      const instance = BaseStruct.eval({}, { defaults: {} });
      const props    = Object.getOwnPropertyNames(instance);
      expect(props).toEqual([]);
    });

    test('throws given `defaults` with any properties', () => {
      // ...because the base class doesn't define any properties.
      expect(() => BaseStruct.eval({}, { defaults: { beep: 'boop' } })).toThrow();
    });
  });
});

describe('using a subclass', () => {
  class SomeStruct extends BaseStruct {
    // @defaultConstructor

    // xeslint-disable-next-line
    _struct_florp(value) {
      if (value === 'return-undefined') {
        return undefined;
      } else if (typeof value !== 'number') {
        throw new Error('Not a number!');
      } else {
        return value;
      }
    }
  }

  describe('with no `defaults`', () => {
    test('throws if a required property is missing', () => {
      expect(() => SomeStruct.eval({})).toThrow();
    });

    test('produces the expected result if all required properties are present and valid', () => {
      const props    = { florp: 123 };
      const instance = SomeStruct.eval(props);
      expectResult(instance, SomeStruct, props);
    });

    test('throws if a property does not pass the property-specific validation', () => {
      expect(() => SomeStruct.eval({ florp: 'non-number' })).toThrow();
    });

    test('throws if a property-specific validation returns `undefined`', () => {
      expect(() => SomeStruct.eval({ florp: 'return-undefined' })).toThrow();
    });
  });

  describe('with non-empty `defaults`', () => {
    test('fills in a missing argument property', () => {
      const defaults = { florp: 543 };
      const instance = SomeStruct.eval({}, { defaults });
      expectResult(instance, SomeStruct, defaults);
    });

    test('does not override an existing argument property', () => {
      const props    = { florp: 6789 };
      const defaults = { florp: 4321 };
      const instance = SomeStruct.eval(props, { defaults });
      expectResult(instance, SomeStruct, props);
    });
  });
});
