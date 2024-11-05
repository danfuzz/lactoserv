// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseText, StringText } from '@this/texty';


describe('.length', () => {
  test('throws', () => {
    const text = new BaseText();
    expect(() => text.length).toThrow();
  });
});

describe('render()', () => {
  class TestText extends StringText {
    calledMulti = false;

    _impl_renderMultiline(options) {
      this.calledMulti = true;
      return super._impl_renderMultiline(options);
    }
  }

  test('handles the case where a single-line render fits at the start of a line with no indentation', () => {
    const text = new TestText('this will fit!');
    const got  = text.render({ maxWidth: 50 });
    expect(got).toStrictEqual({ endColumn: 14, value: 'this will fit!' });
    expect(text.calledMulti).toBeFalse();
  });

  test('handles the case where a single-line render fits at the start of a line with some indentation', () => {
    const text = new TestText('this will fit!');
    const got  = text.render({ maxWidth: 50, indentLevel: 2, indentWidth: 3 });
    expect(got).toStrictEqual({ endColumn: 20, value: '      this will fit!' });
    expect(text.calledMulti).toBeFalse();
  });

  test('handles the case where a single-line render fits at the end of a line-in-progress', () => {
    const text = new TestText('yeppers!');
    const got  = text.render({ atColumn: 30, maxWidth: 50, indentLevel: 2, indentWidth: 3 });
    expect(got).toStrictEqual({ endColumn: 38, value: 'yeppers!' });
    expect(text.calledMulti).toBeFalse();
  });

  test('handles the case where a single-line render will not fit at the end of a line-in-progress', () => {
    const text = new TestText('another line please!');
    const got  = text.render({ atColumn: 40, maxWidth: 50, indentLevel: 4, indentWidth: 2 });
    expect(got).toStrictEqual({ endColumn: 28, value: '\n        another line please!' });
    expect(text.calledMulti).toBeFalse();
  });

  test('handles the case where a multi-line render is required, at the start of a line', () => {
    const text = new TestText('too wide today.');
    const got  = text.render({ maxWidth: 14 });
    expect(got).toStrictEqual({ endColumn: 15, value: 'too wide today.' });
    expect(text.calledMulti).toBeTrue();
  });

  test('handles the case where a multi-line render is required, with a line already in progress', () => {
    const text = new TestText('too wide today. so very wide!!');
    const got  = text.render({ atColumn: 10, maxWidth: 20, indentLevel: 1, indentWidth: 2 });
    expect(got).toStrictEqual({ endColumn: 32, value: '\n  too wide today. so very wide!!' });
    expect(text.calledMulti).toBeTrue();
  });
});

describe('.toString()', () => {
  test('throws', () => {
    const text = new BaseText();
    expect(() => text.toString()).toThrow();
  });
});

describe('_impl_renderMultiline()', () => {
  test('is not overridden by `StringText`', () => {
    // If this fails, then the rest of the tests for this method are invalid,
    // as they'd be calling the wrong method.
    const method1 = new BaseText()._impl_renderMultiline;
    const method2 = new StringText('x')._impl_renderMultiline;

    expect(method1).toBe(method2);
  });

  describe('when `allowBreak === false`', () => {
    test('just returns the result of `toString()` if not at the start of a line', () => {
      const str  = 'florp fleep flop plop pleep gleep glorp.'
      const text = new StringText(str);
      const got  = text._impl_renderMultiline({
        atColumn:    100,
        allowBreak:  false,
        indentWidth: 3,
        indentLevel: 5
      });

      expect(got).toStrictEqual({ endColumn: 140, value: str });
    });

    test('includes indentation if at the start of a line', () => {
      const str  = 'zibbity zubbity zoobity.'
      const text = new StringText(str);
      const got  = text._impl_renderMultiline({
        atColumn:    -1,
        allowBreak:  false,
        indentWidth: 2,
        indentLevel: 3
      });

      expect(got).toStrictEqual({ endColumn: 30, value: `      ${str}` });
    });
  });

  describe('when `allowBreak === true`', () => {
    test('includes a newline and indentation if not at the start of a line', () => {
      const str  = 'chirp chorp.';
      const text = new StringText(str);
      const got  = text._impl_renderMultiline({
        atColumn:    1,
        allowBreak:  true,
        indentWidth: 1,
        indentLevel: 3
      });

      expect(got).toStrictEqual({ endColumn: 15, value: `\n   ${str}` });
    });

    test('includes indentation if at the start of a line', () => {
      const str  = 'gnip gnop gnoop.'
      const text = new StringText(str);
      const got  = text._impl_renderMultiline({
        atColumn:    -1,
        allowBreak:  true,
        indentWidth: 3,
        indentLevel: 2
      });

      expect(got).toStrictEqual({ endColumn: 22, value: `      ${str}` });
    });
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
