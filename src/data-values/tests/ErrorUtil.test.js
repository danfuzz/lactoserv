// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ErrorUtil } from '@this/data-values';


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
