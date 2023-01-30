// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { AskIf } from '@this/typey';

import { Construct, DataValues, NonData } from '@this/data-values';


describe('.TO_DATA', () => {
  test('is a symbol', () => {
    expect(DataValues.TO_DATA).toBeSymbol();
  });
});

describe('toData()', () => {
  describe('with default options', () => {
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
        expect(DataValues.toData(value)).toBe(value);
      });
    });

    test('inspects functions', () => {
      const florp = () => 123;
      const data  = DataValues.toData(florp);
      expect(data).toBe('[Function: florp]');
    });

    test('inspects unspecial instances', () => {
      class Florp {
        like = 123;
      }

      const florp = new Florp();
      const data  = DataValues.toData(florp);
      expect(data).toBe('Florp { like: 123 }');
    });

    describe('on instances that define a TO_DATA method', () => {
      test('calls the TO_DATA method exactly once', () => {
        let calledCount = 0;
        class Florp {
          [DataValues.TO_DATA]() {
            calledCount++;
            return 123;
          }
        }

        const florp = new Florp();
        const data  = DataValues.toData(florp);
        expect(calledCount).toBe(1);
        expect(data).toBe(123);
      });

      test('converts the value returned from the TO_DATA call', () => {
        const theData = [1, 2, 3];
        class Florp {
          [DataValues.TO_DATA]() { return theData; }
        }
        const florp = new Florp();
        const data  = DataValues.toData(florp);
        expect(data).not.toBe(theData);
        expect(data).toBeFrozen();
        expect(data).toStrictEqual(theData);
      });
    });

    describe('on arrays', () => {
      test('returns a frozen array', () => {
        const data = DataValues.toData([1]);
        expect(data).toBeArray();
        expect(data).toBeFrozen();
      });

      test('does not return the same array if given a non-frozen one', () => {
        const orig = ['x'];
        const data = DataValues.toData(orig);
        expect(data).not.toBe(orig);
      });

      test('returns a strict-equal array', () => {
        const orig = ['x', [1, 2, 3], { foo: 'bar' }];
        const data = DataValues.toData(orig);
        expect(data).toStrictEqual(orig);
      });

      test('returns the same array if given a frozen one whose contents all trivially self-represent', () => {
        const orig = Object.freeze(['x', 123, false, undefined, Symbol('foo')]);
        const data = DataValues.toData(orig);
        expect(data).toBe(orig);
      });

      test('returns the same array if given a frozen one whose contents self-represent and are already frozen', () => {
        const orig = Object.freeze([
          'x',
          Object.freeze([123, 456, Object.freeze({ x: 'yes' })]),
          Object.freeze({ z: Object.freeze([false, true]) })
        ]);
        const data = DataValues.toData(orig);
        expect(data).toBe(orig);
      });

      test('returns a different array if any elements need to become frozen', () => {
        const orig = [1, 2, 3, [1, 2, 3], 4, 5, 6];
        const data = DataValues.toData(orig);
        expect(data).not.toBe(orig);
      });

      test('produces a sparse array given a sparse array', () => {
        const orig  = [];
        orig[4]     = 444;
        orig[7]     = 777;
        orig.length = 10;

        const got = DataValues.toData(orig);
        expect(got).toBeArrayOfSize(10);
        expect(got).toStrictEqual(orig);
        expect(Object.getOwnPropertyNames(got)).toStrictEqual(['4', '7', 'length']);
      });

      test('includes converted non-index properties', () => {
        const orig = [1, 2, 3];
        orig.florp = ['like', 'yeah'];

        const got = DataValues.toData(orig);
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

        const got = DataValues.toData(orig);
        expect(got).toBeArrayOfSize(2);
        expect(got).not.toStrictEqual(orig);
        expect(got[0]).toBe(orig[0]);
        expect(got[1]).toBe(orig[1]);
        expect(Object.getOwnPropertySymbols(got)).toStrictEqual([]);
      });
    });

    describe('on plain objects', () => {
      test('returns a frozen plain object', () => {
        const data = DataValues.toData({ x: 10 });
        expect(AskIf.plainObject(data)).toBeTrue();
        expect(data).toBeFrozen();
      });

      test('does not return the same object if given a non-frozen one', () => {
        const orig = { beep: 'boop' };
        const data = DataValues.toData(orig);
        expect(data).not.toBe(orig);
      });

      test('returns a strict-equal object', () => {
        const orig = { a: 10, b: 20, c: [true, false] };
        const data = DataValues.toData(orig);
        expect(data).toStrictEqual(orig);
      });

      test('returns the same object if given a frozen one whose contents all trivially self-represent', () => {
        const orig = Object.freeze({ a: 10, b: false, c: Symbol('like') });
        const data = DataValues.toData(orig);
        expect(data).toBe(orig);
      });

      test('returns the same object if given a frozen one whose contents self-represent and are already frozen', () => {
        const orig = Object.freeze({
          one:   'x',
          two:   Object.freeze([123, 456, Object.freeze({ x: 'yes' })]),
          three: Object.freeze({ z: Object.freeze([false, true]) })
        });
        const data = DataValues.toData(orig);
        expect(data).toBe(orig);
      });

      test('returns a different object if any elements need to become frozen', () => {
        const orig = Object.freeze({
          x: 123,
          y: [4, 5, 6],
          z: { seven: 89 }
        });
        const data = DataValues.toData(orig);
        expect(data).not.toBe(orig);
      });

      test('does not include symbol-keyed properties', () => {
        const sym  = Symbol('nopers');
        const orig = { a: 10, b: 20 };
        orig[sym] = 'never';

        const got = DataValues.toData(orig);
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
        const value1 = new Construct('x', 1, 2, 3);
        const value2 = new NonData(['blort']);
        expect(DataValues.toData(value1)).toBe(value1);
        expect(DataValues.toData(value2)).toBe(value2);
      });

      test('self-represent when embedded in compound objects', () => {
        const value1 = new Construct('x', 1, 2, 3);
        const value2 = new NonData(['blort']);

        const data = {
          v1: value1,
          v2: value2,
          both: [value1, value2]
        };

        const got = DataValues.toData(data);

        expect(got.v1).toBe(value1);
        expect(got.v2).toBe(value2);
        expect(got.both[0]).toBe(value1);
        expect(got.both[1]).toBe(value2);
      });
    });
  });
});
