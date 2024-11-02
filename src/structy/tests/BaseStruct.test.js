// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseStruct } from '@this/structy';


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
  expect(instance).toBeFrozen();

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

      test('produces a frozen instance', () => {
        const instance = new BaseStruct(...args);
        expect(instance).toBeFrozen();
      });

      test('produces an empty instance', () => {
        const instance = new BaseStruct(...args);
        expectResult(instance, BaseStruct, {});
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
      expect(() => new BaseStruct({ what: 'nope' })).toThrow(/Extra property:/);
    });
  });

  describe('_impl_propertyPrefix', () => {
    test('is `prop`', () => {
      const instance = new BaseStruct();

      expect(instance._impl_propertyPrefix()).toBe('prop');
    });
  });

  describe('_impl_validate', () => {
    test('returns its argument', () => {
      const instance = new BaseStruct();
      const someObj  = { a: 'bcd' };

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
        expectResult(instance, BaseStruct, {});
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
      expectResult(instance, BaseStruct, {});
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

    _prop_abc(value = 'xyz') {
      return value;
    }

    _prop_florp(value) {
      if (value === 'return-undefined') {
        return undefined;
      } else if (typeof value !== 'number') {
        throw new Error('Not a number!');
      } else {
        return value;
      }
    }

    /** @override */
    _impl_validate(lessRawObject) {
      switch (lessRawObject.florp) {
        case 100: return { flip: 'flop' };
        case 200: return undefined;
        default:  return lessRawObject;
      }
    }
  }

  describe('eval()', () => {
    describe('with no `defaults`', () => {
      test('given a direct instance of the class, returns it', () => {
        const instance = new SomeStruct({ florp: 432 });
        expect(SomeStruct.eval(instance)).toBe(instance);
      });

      test('given an instance of a subclass, returns it', () => {
        class SomeSubStruct extends SomeStruct {
          // @emptyBlock
        }

        const instance = new SomeSubStruct({ florp: 987 });
        expect(SomeStruct.eval(instance)).toBe(instance);
      });

      test('throws if given an instance of superclass', () => {
        const instance = new BaseStruct();
        expect(() => SomeStruct.eval(instance)).toThrow();
      });

      test('throws if a required property is missing', () => {
        expect(() => SomeStruct.eval({})).toThrow();
      });

      test('throws if there is one extra property', () => {
        expect(() => SomeStruct.eval({ florp: 1, boop: 2 })).toThrow(/Extra property:/);
      });

      test('throws if there are two extra properties', () => {
        expect(() => SomeStruct.eval({ florp: 1, boop: 2, beep: 3 })).toThrow(/Extra properties:/);
      });

      test('produces the expected result if all required properties are present and valid', () => {
        const props    = { florp: 123 };
        const instance = SomeStruct.eval(props);
        expectResult(instance, SomeStruct, { ...props, abc: 'xyz' });
      });

      test('allows a property with a property-specific default to be overridden', () => {
        const props    = { florp: 12, abc: 'pdq' };
        const instance = SomeStruct.eval(props);
        expectResult(instance, SomeStruct, props);
      });

      test('produces the expected result if `_impl_validate()` returns a replacement', () => {
        const instance = SomeStruct.eval({ florp: 100 });
        expectResult(instance, SomeStruct, { flip: 'flop' });
      });

      test('throws if a property does not pass the property-specific validation', () => {
        expect(() => SomeStruct.eval({ florp: 'non-number' })).toThrow();
      });

      test('throws if a property-specific validation returns `undefined`', () => {
        expect(() => SomeStruct.eval({ florp: 'return-undefined' })).toThrow();
      });

      test('throws if `_impl_validate()` returns `undefined`', () => {
        expect(() => SomeStruct.eval({ florp: 200 })).toThrow();
      });
    });

    describe('with non-empty `defaults`', () => {
      test('fills in a missing argument property', () => {
        const defaults = { florp: 543 };
        const instance = SomeStruct.eval({}, { defaults });
        expectResult(instance, SomeStruct, { ...defaults, abc: 'xyz' });
      });

      test('does not override an existing argument property', () => {
        const props    = { florp: 6789 };
        const defaults = { florp: 4321 };
        const instance = SomeStruct.eval(props, { defaults });
        expectResult(instance, SomeStruct, { ...props, abc: 'xyz' });
      });

      test('throws if `default` has a property not defined by the class', () => {
        const props    = { florp: 6789 };
        const defaults = { zonk: 4321 };
        expect(() => SomeStruct.eval(props, { defaults })).toThrow();
      });
    });
  });
});
