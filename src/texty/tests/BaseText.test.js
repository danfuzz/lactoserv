// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseText } from '@this/texty';


describe('.length', () => {
  test('throws', () => {
    const text = new BaseText();
    expect(() => text.length).toThrow();
  });
});

describe('.toString()', () => {
  test('throws', () => {
    const text = new BaseText();
    expect(() => text.toString()).toThrow();
  });
});


//
// Static members
//

describe('indentString()', () => {
  test.each`
  level | width
  ${0}  | ${0}
  ${1}  | ${0}
  ${0}  | ${1}
  ${1}  | ${1}
  ${1}  | ${2}
  ${2}  | ${1}
  ${2}  | ${2}
  ${3}  | ${4}
  ${8}  | ${4}
  ${10} | ${4}
  `('works given ($level, $width)', ({ level, width }) => {
    const expected = ' '.repeat(level * width);
    const opts     = { indentLevel: level, indentWidth: width };
    const got1     = BaseText.indentString(opts);
    const got2     = BaseText.indentString(opts);
    expect(got1).toBe(expected);
    expect(got2).toBe(expected);
  });
});

describe('visibleLengthOf()', () => {
  class TestText extends BaseText {
    #length;

    constructor(length) {
      super();
      this.#length = length;
    }

    get length() {
      return this.#length;
    }
  }

  const text5 = new TestText(5);
  const text7 = new TestText(7);

  test.each`
  label              | expected | args
  ${'no arguments'}  | ${0}     | ${[]}
  ${'one string'}    | ${4}     | ${['boop']}
  ${'two strings'}   | ${7}     | ${['boo', 'boop']}
  ${'one text'}      | ${5}     | ${[text5]}
  ${'two texts'}     | ${12}    | ${[text5, text7]}
  ${'a mix of both'} | ${24}    | ${['z', text5, 'y', text7, text7, 'xyz']}
  `('works given $label', ({ expected, args }) => {
    expect(BaseText.visibleLengthOf(...args)).toBe(expected);
  });
});
