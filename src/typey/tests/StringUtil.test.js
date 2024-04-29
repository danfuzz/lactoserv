// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { StringUtil } from '@this/typey';


describe('checkAndFreezeStrings()', () => {
  test.each`
  arg
  ${null}
  ${undefined}
  ${123}
  ${{ a: 10 }}
  ${new Map()}
  `('throws given invalid first argument $arg', ({ arg }) => {
    expect (() => StringUtil.checkAndFreezeStrings(arg, /florp/)).toThrow();
  });

  test.each`
  arg
  ${null}
  ${undefined}
  ${123}
  ${[1, 2, 3]}
  ${{ a: 10 }}
  ${new Map()}
  `('throws given invalid second argument $arg', ({ arg }) => {
    expect (() => StringUtil.checkAndFreezeStrings([], arg)).toThrow();
  });

  describe('given a string first argument', () => {
    test('returns an array with it, if it passes a regex filter', () => {
      const value  = 'florp';
      const result = StringUtil.checkAndFreezeStrings(value, /^f/);

      expect(result).toBeFrozen();
      expect(result).toEqual(['florp']);
    });

    test('returns an array with it, if it passes a regex filter passed as a string', () => {
      const value  = 'florp';
      const result = StringUtil.checkAndFreezeStrings(value, '^f');

      expect(result).toBeFrozen();
      expect(result).toEqual(['florp']);
    });

    test('returns its filtered value, as mapped by a filter function', () => {
      const value  = 'florp';
      const filter = (x) => x.toUpperCase();
      const result = StringUtil.checkAndFreezeStrings(value, filter);

      expect(result).toBeFrozen();
      expect(result).toEqual(['FLORP']);
    });

    test('throws, if it does not pass a regex filter', () => {
      const value  = 'florp';
      expect (() => StringUtil.checkAndFreezeStrings(value, /^g/)).toThrow();
    });

    test('throws, if it does not pass a regex filter passed as a string', () => {
      const value  = 'florp';
      expect (() => StringUtil.checkAndFreezeStrings(value, '^g')).toThrow();
    });

    test('throws, if a filter function throws', () => {
      const value  = 'florp';
      const filter = (x_unused) => { throw new Error('Ouch!'); };

      expect (() => StringUtil.checkAndFreezeStrings(value, filter)).toThrow();
    });
  });

  describe('given an array first argument', () => {
    function checkResult(arg, got, expected = arg) {
      expect(got).toBeFrozen();
      expect(got).toEqual(expected);
      expect(got).not.toBe(arg);
    }

    test('returns a frozen empty array if given an empty array', () => {
      const arg    = [];
      const result = StringUtil.checkAndFreezeStrings(arg, /florp/);
      checkResult(arg, result);
    });

    test('returns a frozen copy, if all elements pass a regex filter', () => {
      const arg    = ['flip', 'flop', 'florp'];
      const result = StringUtil.checkAndFreezeStrings(arg, /p$/);
      checkResult(arg, result);
    });

    test('returns an array with it, if it passes a regex filter passed as a string', () => {
      const arg    = ['flip', 'flop', 'florp'];
      const result = StringUtil.checkAndFreezeStrings(arg, 'p$');
      checkResult(arg, result);
    });

    test('returns the filtered values, as mapped by a filter function', () => {
      const arg    = ['zip', 'zap', 'zowie', 'zamboni', 'urp'];
      const filter = (x) => x.startsWith('z') ? `YES-${x}` : `NO-${x}`;
      const result = StringUtil.checkAndFreezeStrings(arg, filter);
      checkResult(arg, result, ['YES-zip', 'YES-zap', 'YES-zowie', 'YES-zamboni', 'NO-urp']);
    });

    test('throws, if an element does not pass a regex filter', () => {
      const arg = ['glorp', 'florp'];
      expect (() => StringUtil.checkAndFreezeStrings(arg, /^g/)).toThrow();
    });

    test('throws, if an element does not pass a regex filter passed as a string', () => {
      const arg  = ['goop', 'glop', 'flop', 'glip'];
      expect (() => StringUtil.checkAndFreezeStrings(arg, '^g')).toThrow();
    });

    test('throws, if a filter function throws', () => {
      const arg    = ['zip', 'zap', 'urp', 'zowie', 'zamboni'];
      const filter = (x) => {
        if (x.startsWith('z')) return x;
        else throw new Error('Ouch!');
      };

      expect (() => StringUtil.checkAndFreezeStrings(arg, filter)).toThrow();
    });
  });
});
