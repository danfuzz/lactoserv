// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ErrorUtil } from '@this/util';


describe('collateErrors()', () => {
  function expectOk(result) {
    expect(result).toEqual({
      errorCodes: [],
      errors:     {},
      ok:         true
    });
  }

  test('returns an empty `ok` given an empty argument', () => {
    expectOk(ErrorUtil.collateErrors({}));
  });

  test('returns an empty `ok` given a bunch of bindings to `null` and `undefined`', () => {
    expectOk(ErrorUtil.collateErrors({
      one:   null,
      two:   undefined,
      three: null,
      four:  undefined
    }));
  });

  test('returns a single-error result, given a single-binding error-bearing argument (with `code`)', () => {
    const err = new Error('Ouchie!');
    err.code = 'FLORP_LIKE';

    const got = ErrorUtil.collateErrors({ someError: err });
    expect(got).toEqual({
      errorCodes: ['florp-like'],
      errors:     { someError: err },
      ok:         false
    });
  });

  test('returns a single-error result, given a single-binding error-bearing argument (without `code`)', () => {
    const err = new Error('What the muffin?!');

    const got = ErrorUtil.collateErrors({ bonk: err });
    expect(got).toEqual({
      errorCodes: ['what-the-muffin'],
      errors:     { bonk: err },
      ok:         false
    });
  });

  test('returns a single-error result, given a single-binding string-bearing argument', () => {
    const err = 'Oh no, not again!';

    const got = ErrorUtil.collateErrors({ oof: err });
    expect(got).toEqual({
      errorCodes: ['oh-no-not-again'],
      errors:     { oof: err },
      ok:         false
    });
  });

  test('deduplicates an error that occurs twice', () => {
    const err = new Error('Ouchie!');
    err.code = 'no-way';

    const got = ErrorUtil.collateErrors({ errorA: err, errorB: err });
    expect(got).toEqual({
      errorCodes: ['no-way'],
      errors:     { errorA: err, errorB: 'errorA' },
      ok:         false
    });
  });

  test('deduplicates an error _code_ that occurs twice in two different errors', () => {
    const err1 = 'no-way';
    const err2 = new Error('Ouchie!');
    err2.code = 'no-way';

    const got = ErrorUtil.collateErrors({ error1: err1, error2: err2 });
    expect(got).toEqual({
      errorCodes: ['no-way'],
      errors:     { error1: err1, error2: err2 },
      ok:         false
    });
  });

  test('does not include `null`s and `undefined`s in an error-bearing result', () => {
    const err = 'oy';
    const got = ErrorUtil.collateErrors({
      error1: null,
      error2: undefined,
      error3: err,
      error4: null
    });

    expect(got).toEqual({
      errorCodes: ['oy'],
      errors:     { error3: err },
      ok:         false
    });
  });

  test('produces `errorCodes` in sorted order, uniqued', () => {
    const err1 = 'floop';
    const err2 = 'boop';
    const err3 = 'zoop';
    const err4 = new Error('floop');
    const err5 = 'goop';
    const got = ErrorUtil.collateErrors({ err1, err2, err3, err4, err5 });

    expect(got).toEqual({
      errorCodes: ['boop', 'floop', 'goop', 'zoop'],
      errors:     { err1, err2, err3, err4, err5 },
      ok:         false
    });
  });
});

describe('extractErrorCode()', () => {
  test('given an Error with a `.code`, returns the converted code', () => {
    const err = new Error('Ouch!');
    err.code = 'ZIP_ZONK_2000';
    expect(ErrorUtil.extractErrorCode(err)).toBe('zip-zonk-2000');
  });

  test('given an Error without a `.code`, returns a formatted extract of `message`', () => {
    const err = new Error('Ouch! That_really hurt-a-lot. Please refrain from doing it again.');
    expect(ErrorUtil.extractErrorCode(err)).toBe('ouch-that-really-hurt-a-lot-pl');
  });

  test('given a string, returns a formatted extract of it', () => {
    const err = 'Well, isn\'t THAT a poke or 2 in the nose.';
    expect(ErrorUtil.extractErrorCode(err)).toBe('well-isnt-that-a-poke-or-2-in-');
  });

  test('given a non-Error non-string, returns a generic value', () => {
    const err = 12345;
    expect(ErrorUtil.extractErrorCode(err)).toBe('err-unknown');
  });
});
