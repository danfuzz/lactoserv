// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConverter, Converter, ConverterConfig, Ref, Struct }
  from '@this/data-values';
import { AskIf } from '@this/typey';


describe('decode()', () => {
  // Just a placeholder, until decoding is actually implemented.
});

describe('encode()', () => {
  describe('with default config', () => {
    describe('on simple data', () => {
      test.each`
      value
      ${undefined}
      ${null}
      ${false}
      ${true}
      ${0}
      ${123}
      ${123.456}
      ${Number.POSITIVE_INFINITY}
      ${Number.NEGATIVE_INFINITY}
      ${Number.NaN}
      ${0n}
      ${-123n}
      ${''}
      ${'blort'}
      ${Symbol('uninterned')}
      ${Symbol.for('interned')}
      `('self-represents $value', ({ value }) => {
        const conv = new Converter();
        expect(conv.encode(value)).toBe(value);
      });
    });

    test('wraps functions', () => {
      const florp = () => 123;

      const conv = new Converter();
      const data = conv.encode(florp);

      expect(data).toBeInstanceOf(Ref);
      expect(data.value).toBe(florp);
    });

    test('wraps unspecial instances', () => {
      class Florp {
        like = 123;
      }

      const florp = new Florp();

      const conv = new Converter();
      const data = conv.encode(florp);

      expect(data).toBeInstanceOf(Ref);
      expect(data.value).toBe(florp);
    });

    describe('on instances that define an `ENCODE()` method', () => {
      test('calls `ENCODE()` exactly once', () => {
        let calledCount = 0;
        class Florp {
          [BaseConverter.ENCODE]() {
            calledCount++;
            return 123;
          }
        }

        const florp = new Florp();

        const conv = new Converter();
        const data = conv.encode(florp);
        expect(calledCount).toBe(1);
        expect(data).toBe(123);
      });

      test('converts the value returned from `ENCODE()`', () => {
        const theData = [1, 2, 3];
        class Florp {
          [BaseConverter.ENCODE]() { return theData; }
        }
        const florp = new Florp();

        const conv = new Converter();
        const data = conv.encode(florp);
        expect(data).not.toBe(theData);
        expect(data).toBeFrozen();
        expect(data).toStrictEqual(theData);
      });
    });

    describe('on arrays', () => {
      test('returns a frozen array', () => {
        const conv = new Converter();
        const data = conv.encode([1]);

        expect(data).toBeArray();
        expect(data).toBeFrozen();
      });

      test('does not return the same array if given a non-frozen one', () => {
        const orig = ['x'];

        const conv = new Converter();
        const data = conv.encode(orig);

        expect(data).not.toBe(orig);
      });

      test('returns a strict-equal array', () => {
        const orig = ['x', [1, 2, 3], { foo: 'bar' }];

        const conv = new Converter();
        const data = conv.encode(orig);

        expect(data).toStrictEqual(orig);
      });

      test('returns the same array if given a frozen one whose contents all trivially self-represent', () => {
        const orig = Object.freeze(['x', 123, false, undefined, Symbol('foo')]);

        const conv = new Converter();
        const data = conv.encode(orig);
        expect(data).toBe(orig);
      });

      test('returns the same array if given a frozen one whose contents self-represent and are already frozen', () => {
        const orig = Object.freeze([
          'x',
          Object.freeze([123, 456, Object.freeze({ x: 'yes' })]),
          Object.freeze({ z: Object.freeze([false, true]) })
        ]);

        const conv = new Converter();
        const data = conv.encode(orig);
        expect(data).toBe(orig);
      });

      test('returns a different array if any elements need to become frozen', () => {
        const orig = [1, 2, 3, [1, 2, 3], 4, 5, 6];

        const conv = new Converter();
        const data = conv.encode(orig);
        expect(data).not.toBe(orig);
      });

      test('produces a sparse array given a sparse array', () => {
        const orig  = [];
        orig[4]     = 444;
        orig[7]     = 777;
        orig.length = 10;

        const conv = new Converter();
        const got  = conv.encode(orig);

        expect(got).toBeArrayOfSize(10);
        expect(got).toStrictEqual(orig);
        expect(Object.getOwnPropertyNames(got)).toStrictEqual(['4', '7', 'length']);
      });

      test('includes converted non-index properties', () => {
        const orig = [1, 2, 3];
        orig.florp = ['like', 'yeah'];

        const conv = new Converter();
        const got  = conv.encode(orig);

        expect(got).toBeArrayOfSize(3);
        expect(got).toStrictEqual(orig);
        expect(got.florp).toStrictEqual(orig.florp);
        expect(got.florp).not.toBe(orig.florp);
        expect(got.florp).toBeFrozen();
      });

      test('does not include symbol-keyed properties', () => {
        const sym  = Symbol('nopers');
        const orig = ['a', 'b'];
        orig[sym] = 'never';

        const conv = new Converter();
        const got  = conv.encode(orig);

        expect(got).toBeArrayOfSize(2);
        expect(got).not.toStrictEqual(orig);
        expect(got[0]).toBe(orig[0]);
        expect(got[1]).toBe(orig[1]);
        expect(Object.getOwnPropertySymbols(got)).toStrictEqual([]);
      });
    });

    describe('on plain objects', () => {
      test('returns a frozen plain object', () => {
        const conv = new Converter();
        const data = conv.encode({ x: 10 });

        expect(AskIf.plainObject(data)).toBeTrue();
        expect(data).toBeFrozen();
      });

      test('does not return the same object if given a non-frozen one', () => {
        const orig = { beep: 'boop' };

        const conv = new Converter();
        const data = conv.encode(orig);

        expect(data).not.toBe(orig);
      });

      test('returns a strict-equal object', () => {
        const orig = { a: 10, b: 20, c: [true, false] };

        const conv = new Converter();
        const data = conv.encode(orig);
        expect(data).toStrictEqual(orig);
      });

      test('returns the same object if given a frozen one whose contents all trivially self-represent', () => {
        const orig = Object.freeze({ a: 10, b: false, c: Symbol('like') });

        const conv = new Converter();
        const data = conv.encode(orig);
        expect(data).toBe(orig);
      });

      test('returns the same object if given a frozen one whose contents self-represent and are already frozen', () => {
        const orig = Object.freeze({
          one:   'x',
          two:   Object.freeze([123, 456, Object.freeze({ x: 'yes' })]),
          three: Object.freeze({ z: Object.freeze([false, true]) })
        });

        const conv = new Converter();
        const data = conv.encode(orig);
        expect(data).toBe(orig);
      });

      test('returns a different object if any elements need to become frozen', () => {
        const orig = Object.freeze({
          x: 123,
          y: [4, 5, 6],
          z: { seven: 89 }
        });

        const conv = new Converter();
        const data = conv.encode(orig);

        expect(data).not.toBe(orig);
      });

      test('does not include symbol-keyed properties', () => {
        const sym  = Symbol('nopers');
        const orig = { a: 10, b: 20 };
        orig[sym] = 'never';

        const conv = new Converter();
        const got  = conv.encode(orig);

        expect(got).toBeObject();
        expect(got).not.toStrictEqual(orig);
        expect(got).toContainAllKeys(['a', 'b']);
        expect(got.a).toBe(orig.a);
        expect(got.b).toBe(orig.b);
        expect(Object.getOwnPropertySymbols(got)).toStrictEqual([]);
      });
    });

    describe('on instances of data classes', () => {
      test('self-represent when directly converted', () => {
        const value1 = Object.freeze(new Struct('x', null, 1, 2, 3));
        const value2 = new Ref(['blort']);

        const conv = new Converter();

        expect(conv.encode(value1)).toBe(value1);
        expect(conv.encode(value2)).toBe(value2);
      });

      test('self-represent when embedded in compound objects', () => {
        const value1 = Object.freeze(new Struct('x', { x: 123 }, 1, 2, 3));
        const value2 = new Ref(['blort', 'fleep']);

        const data = {
          v1: value1,
          v2: value2,
          both: [value1, value2]
        };

        const conv = new Converter();
        const got  = conv.encode(data);

        expect(got.v1).toBe(value1);
        expect(got.v2).toBe(value2);
        expect(got.both[0]).toBe(value1);
        expect(got.both[1]).toBe(value2);
      });

      test('copies a non-frozen `Struct` that requires no inner encoding', () => {
        const value = new Struct('floop', { a: 10, b: 20 }, 1, 2, 3);
        const conv  = new Converter();
        const got   = conv.encode(value);

        expect(got).not.toBe(value);
        expect(got).toBeFrozen();
        expect(got.type).toBe(value.type);
        expect(got.args).toStrictEqual(value.args);
        expect(got.options).toStrictEqual(value.options);
      });
    });

    describe('on instances of specially-handled classes', () => {
      test('handles class `Error` (simple case)', () => {
        const err = new Error('Oy!');

        const conv = new Converter();
        const got  = conv.encode(err);

        expect(got).toBeInstanceOf(Struct);
        expect(got.type).toBeInstanceOf(Ref);
        expect(got.type.value).toBe(Error);
        expect(got.args).toBeArrayOfSize(1);
        expect(got.args[0]).toStrictEqual({
          name:    'Error',
          message: err.message,
          stack:   err.stack
        });
      });

      test('handles class `Error` (complicated case)', () => {
        const cause = new TypeError('Oh biscuits!');
        const err   = new Error('What the muffin?!', { cause });

        err.code        = 'muffins';
        err.name        = 'MuffinError';
        err.blueberries = true;

        const conv = new Converter();
        const got  = conv.encode(err);

        expect(got).toBeInstanceOf(Struct);
        expect(got.type).toBeInstanceOf(Ref);
        expect(got.type.value).toBe(Error);
        expect(got.args).toBeArrayOfSize(1);
        expect(got.args[0]).toContainAllKeys(['cause', 'code', 'message', 'name', 'stack']);
        expect(got.options).toStrictEqual({ blueberries: true });

        const { cause: convCause, code, message, name, stack } = got.args[0];
        expect(code).toBe(err.code);
        expect(message).toBe(err.message);
        expect(name).toBe(err.name);
        expect(stack).toBe(err.stack);
        expect(convCause).toBeInstanceOf(Struct);
        expect(convCause.type).toBeInstanceOf(Ref);
        expect(convCause.type.value).toBe(TypeError);
        expect(convCause.args).toBeArrayOfSize(1);
        expect(convCause.args[0]).toStrictEqual({
          name:    cause.name,
          message: cause.message,
          stack:   cause.stack
        });
      });

      // TODO: More!
    });
  });
});

describe('encode()', () => {
  describe('with default config, except `freeze === false`', () => {
    const config = new ConverterConfig({ freeze: false });

    test('returns a non-frozen array that did not need encoding, as-is', () => {
      const conv  = new Converter(config);
      const value = [1, 2, 3];
      const got   = conv.encode(value);

      expect(got).toBe(value);
      expect(got).not.toBeFrozen();
    });

    test('returns a non-frozen object that did not need encoding, as-is', () => {
      const conv  = new Converter(config);
      const value = { a: 'hello', b: 'goodbye' };
      const got   = conv.encode(value);

      expect(got).toBe(value);
      expect(got).not.toBeFrozen();
    });

    test('does not freeze an array that needed encoding', () => {
      const conv  = new Converter(config);
      const value = [1, 2, 3, new Map()];
      const got   = conv.encode(value);

      expect(got).not.toBe(value);
      expect(got).not.toBeFrozen();
      expect(got[0]).toBe(1);
      expect(got[3]).toBeInstanceOf(Ref);
      expect(got[3].value).toBe(value[3]);
    });

    test('does not freeze a plain object that needed encoding', () => {
      const conv  = new Converter(config);
      const value = { boop: new Map() };
      const got   = conv.encode(value);

      expect(got).not.toBe(value);
      expect(got).not.toBeFrozen();
      expect(got.boop).toBeInstanceOf(Ref);
      expect(got.boop.value).toBe(value.boop);
    });

    test('copies an array that is frozen', () => {
      const conv  = new Converter(config);
      const value = Object.freeze([1, 2, 3]);
      const got   = conv.encode(value);

      expect(got).not.toBe(value);
      expect(got).not.toBeFrozen();
      expect(got).toStrictEqual(value);
    });

    test('copies a plain object that is frozen', () => {
      const conv  = new Converter(config);
      const value = Object.freeze({ florp: 'like' });
      const got   = conv.encode(value);

      expect(got).not.toBe(value);
      expect(got).not.toBeFrozen();
      expect(got).toStrictEqual(value);
    });
  });
});
