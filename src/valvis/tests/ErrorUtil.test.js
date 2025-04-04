// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ErrorUtil, StackTrace } from '@this/valvis';


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

describe('deconstructError()', () => {
  test('returns a degenerate result given a non-`Error`', () => {
    const err = [1, 2, 3];
    const got = ErrorUtil.deconstructError(err);

    expect(got).toStrictEqual([Error, { name: 'Error', message: '1,2,3' }]);
  });

  test('deconstructs a plain error as expected', () => {
    const err = new Error('Eep!');
    const got = ErrorUtil.deconstructError(err);

    expect(got).toBeArrayOfSize(2);
    expect(got[0]).toBe(err.constructor);

    const props = got[1];

    expect(props).toContainAllKeys(['name', 'message', 'stack']);
    expect(props.name).toBe('Error');
    expect(props.message).toBe(err.message);
    expect(props.stack).toBeInstanceOf(StackTrace);
  });

  test('does not include a `.stack` if the error does not have a `.stack`', () => {
    const err = new Error('Eep!');

    delete err.stack;

    const got = ErrorUtil.deconstructError(err);

    expect(got).toBeArrayOfSize(2);

    const props = got[1];

    expect(props).not.toContainKey('stack');
  });

  test('does not include a `.stack` if the error has a non-string `.stack`', () => {
    const err = new Error('Eep!');

    err.stack = 123;

    const got = ErrorUtil.deconstructError(err);

    expect(got).toBeArrayOfSize(2);

    const props = got[1];

    expect(props).not.toContainKey('stack');
  });

  test('includes `.code` when the error has one', () => {
    const err = new Error('Eep!');

    err.code = 'CODEY-123';

    const got = ErrorUtil.deconstructError(err);

    expect(got).toBeArrayOfSize(2);

    const props = got[1];

    expect(props).toContainKey('code');
    expect(props.code).toBe(err.code);
  });

  test('includes `.cause` when the error has one', () => {
    const err = new Error('Eep!');

    err.cause = new ReferenceError('sub-error');

    const got = ErrorUtil.deconstructError(err);

    expect(got).toBeArrayOfSize(2);

    const props = got[1];

    expect(props).toContainKey('cause');
    expect(props.cause).toBe(err.cause);
  });

  test('includes `.errors` when the error has one', () => {
    const err = new Error('Eep!');

    err.errors = [new ReferenceError('sub-error'), new TypeError('eep-type')];

    const got = ErrorUtil.deconstructError(err);

    expect(got).toBeArrayOfSize(2);

    const props = got[1];

    expect(props).toContainKey('errors');
    expect(props.errors).toBe(err.errors);
  });

  test('includes a second object argument when the error has extra properties', () => {
    const err = new Error('Eep!');

    err.beep  = 'Beep!';
    err.blorp = 'Blorp!';
    err.zonk  = 25;

    const got = ErrorUtil.deconstructError(err);

    expect(got).toBeArrayOfSize(3);

    const props = got[2];

    expect(props).toStrictEqual({ beep: 'Beep!', blorp: 'Blorp!', zonk: 25 });
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
    expect(ErrorUtil.extractErrorCode(err)).toBe('well-isnt-that-a-poke-or-2-in');
  });

  test('given a non-Error non-string, returns a generic value', () => {
    const err = 12345;
    expect(ErrorUtil.extractErrorCode(err)).toBe('err-unknown');
  });
});
