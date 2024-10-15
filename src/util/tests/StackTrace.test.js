// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { StackTrace } from '@this/util';


/**
 * Subclass of {@link #StackTrace}, so that we can control the generated raw
 * traces.
 */
class MockStackTrace extends StackTrace {
  static generateDepth = 0;

  static makeArray() {
    const result = [];

    for (let i = 1; i <= this.generateDepth; i++) {
      result.push({ name: `depth${i}`, file: `some/file${i}`, line: i * 100, col: i });
    }

    return result;
  }

  static makeError() {
    const result = new Error();
    const lines  = ['Error'];

    for (let i = 1; i <= this.generateDepth; i++) {
      lines.push(`    at depth${i} (some/file${i}:${i}00:${i})`);
    }

    result.stack = lines.join('\n');
    return result;
  }

  static _impl_newError() {
    const result = new Error();
    const lines  = result.stack.split('\n');

    // Look for the last line representing the class under test, and delete the
    // rest after that.
    lines.splice(lines.findLastIndex((line) => /\bStackTrace\.js\b/.test(line)) + 1);

    for (let i = 1; i <= this.generateDepth; i++) {
      lines.push(`    at depth${i} (some/file${i}:${i}00:${i})`);
    }

    result.stack = lines.join('\n');
    return result;
  }
}

describe('constructor() for new trace', () => {
  describe('.frames', () => {
    test('is a frozen array', () => {
      const frames = new StackTrace().frames;
      expect(frames).toBeFrozen();
      expect(frames).toBeArray();
    });

    test('is an array of objects, each with the expected shape', () => {
      const frames = new StackTrace().frames;
      for (const f of frames) {
        expect(StackTrace.isValidFrame(f)).toBeTrue();
      }
    });
  });
});

describe('framesNow()', () => {
  test('returns a frozen array', () => {
    const frames = StackTrace.framesNow();
    expect(frames).toBeFrozen();
    expect(frames).toBeArray();
  });

  test('returns an array of objects, each with the expected shape', () => {
    const frames = StackTrace.framesNow();
    for (const f of frames) {
      expect(StackTrace.isValidFrame(f)).toBeTrue();
    }
  });
});

// This section tests all of `framesNow()`, `framesFrom()`, and the constructor,
// with all the variant type options for `original`, and all the possible
// combinations of extra arguments.
describe.each`
name             | detail               | constructTrace
${'constructor'} | ${' for new trace'}  | ${(...a) => new MockStackTrace(...a).frames}
${'constructor'} | ${' given Error'}    | ${(...a) => new MockStackTrace(MockStackTrace.makeError(), ...a).frames}
${'constructor'} | ${' given string'}   | ${(...a) => new MockStackTrace(MockStackTrace.makeError().stack, ...a).frames}
${'constructor'} | ${' given array'}    | ${(...a) => new MockStackTrace(MockStackTrace.makeArray(), ...a).frames}
${'constructor'} | ${' given instance'} | ${(...a) => new MockStackTrace(new MockStackTrace(), ...a).frames}
${'framesFrom'}  | ${' given Error'}    | ${(...a) => MockStackTrace.framesFrom(MockStackTrace.makeError(), ...a)}
${'framesFrom'}  | ${' given string'}   | ${(...a) => MockStackTrace.framesFrom(MockStackTrace.makeError().stack, ...a)}
${'framesFrom'}  | ${' given array'}    | ${(...a) => MockStackTrace.framesFrom(MockStackTrace.makeArray(), ...a)}
${'framesFrom'}  | ${' given instance'} | ${(...a) => MockStackTrace.framesFrom(new MockStackTrace(), ...a)}
${'framesNow'}   | ${''}                | ${(...a) => MockStackTrace.framesNow(...a)}
`('$name()$detail', ({ constructTrace }) => {
  describe('with no arguments', () => {
    test('produces a full-length stack trace', () => {
      MockStackTrace.generateDepth = 5;
      const trace5 = constructTrace();
      expect(trace5).toBeArrayOfSize(5);

      MockStackTrace.generateDepth = 10;
      const trace10 = constructTrace();
      expect(trace10).toBeArrayOfSize(10);
    });

    test('has the expected contents', () => {
      MockStackTrace.generateDepth = 3;
      const trace3 = constructTrace();
      expect(trace3).toStrictEqual([
        { name: 'depth1', file: 'some/file1', line: 100, col: 1 },
        { name: 'depth2', file: 'some/file2', line: 200, col: 2 },
        { name: 'depth3', file: 'some/file3', line: 300, col: 3 }
      ]);
    });
  });

  describe('with (0)', () => {
    test('produces a full-length stack trace', () => {
      MockStackTrace.generateDepth = 3;
      const trace3 = constructTrace(0);
      expect(trace3).toBeArrayOfSize(3);

      MockStackTrace.generateDepth = 7;
      const trace7 = constructTrace(0);
      expect(trace7).toBeArrayOfSize(7);
    });
  });

  describe('with (1)', () => {
    test('omits the innermost frame', () => {
      MockStackTrace.generateDepth = 3;
      const trace3 = constructTrace(1);
      expect(trace3).toBeArrayOfSize(2);
      expect(trace3[0]).toStrictEqual(
        { name: 'depth2', file: 'some/file2', line: 200, col: 2 });
    });
  });

  describe('with (2)', () => {
    test('omits the innermost two frames', () => {
      MockStackTrace.generateDepth = 8;
      const trace8 = constructTrace(2);
      expect(trace8).toBeArrayOfSize(6);
      expect(trace8[0]).toStrictEqual(
        { name: 'depth3', file: 'some/file3', line: 300, col: 3 });
    });
  });

  describe('with (0, 3)', () => {
    test('does not truncate a two-frame stack', () => {
      MockStackTrace.generateDepth = 2;
      const trace2 = constructTrace(0, 3);
      expect(trace2).toBeArrayOfSize(2);
    });

    test('does not truncate a three-frame stack', () => {
      MockStackTrace.generateDepth = 3;
      const trace3 = constructTrace(0, 3);
      expect(trace3).toBeArrayOfSize(3);
    });

    test('truncates a four-frame stack', () => {
      MockStackTrace.generateDepth = 4;
      const trace4 = constructTrace(0, 3);
      expect(trace4).toBeArrayOfSize(3);
      expect(trace4[0].name).toBe('depth1');
      expect(trace4[2].name).toBe('depth3');
    });
  });

  describe('with (2, 3)', () => {
    test('returns an empty array for a two-frame stack', () => {
      MockStackTrace.generateDepth = 2;
      const trace2 = constructTrace(2, 5);
      expect(trace2).toBeArrayOfSize(0);
    });

    test('returns a one-element array for a three-frame stack', () => {
      MockStackTrace.generateDepth = 3;
      const trace3 = constructTrace(2, 5);
      expect(trace3).toBeArrayOfSize(1);
      expect(trace3[0].name).toBe('depth3');
    });

    test('returns a two-element array for a four-frame stack', () => {
      MockStackTrace.generateDepth = 4;
      const trace4 = constructTrace(2, 5);
      expect(trace4).toBeArrayOfSize(2);
      expect(trace4[0].name).toBe('depth3');
      expect(trace4[1].name).toBe('depth4');
    });

    test('returns a five-element array for a seven-frame stack', () => {
      MockStackTrace.generateDepth = 7;
      const trace7 = constructTrace(2, 5);
      expect(trace7).toBeArrayOfSize(5);
      expect(trace7[0].name).toBe('depth3');
      expect(trace7[4].name).toBe('depth7');
    });

    test('returns a five-element array for an eight-frame stack', () => {
      MockStackTrace.generateDepth = 8;
      const trace8 = constructTrace(2, 5);
      expect(trace8).toBeArrayOfSize(5);
      expect(trace8[0].name).toBe('depth3');
      expect(trace8[4].name).toBe('depth7');
    });
  });
});

describe('isValidFrame()', () => {
  // Non-plain-object cases.
  test.each`
  value
  ${null}
  ${undefined}
  ${false}
  ${true}
  ${123}
  ${[]}
  ${[{ a: 123 }]}
  ${'some-non-object'}
  ${Symbol('blorch')}
  ${Object.freeze(new Map())}
  `('returns false for non-plain-object $value', ({ value }) => {
    expect(StackTrace.isValidFrame(value)).toBeFalse();
  });

  // Incorrect plain object cases.
  test.each`
  label                        | freeze   | value
  ${'non-frozen but complete'} | ${false} | ${{ name: 'x', file: 'x', line: 12, col: 23 }}
  ${'missing name'}            | ${true}  | ${{ file: 'x', line: 12, col: 23 }}
  ${'missing file'}            | ${true}  | ${{ name: 'x', line: 12, col: 23 }}
  ${'missing line'}            | ${true}  | ${{ name: 'x', file: 'x', col: 23 }}
  ${'missing col'}             | ${true}  | ${{ name: 'x', file: 'x', line: 12 }}
  ${'null name'}               | ${true}  | ${{ name: null, file: 'x', line: 12, col: 23 }}
  ${'null file'}               | ${true}  | ${{ name: 'x', file: null, line: 12, col: 23 }}
  ${'non-string name'}         | ${true}  | ${{ name: 123, file: 'x', line: 12, col: 23 }}
  ${'non-string file'}         | ${true}  | ${{ name: 'x', file: ['x'], line: 12, col: 23 }}
  ${'non-number line'}         | ${true}  | ${{ name: 'x', file: ['x'], line: 'boop', col: 23 }}
  ${'non-number col'}          | ${true}  | ${{ name: 'x', file: ['x'], line: 12, col: 'beep' }}
  `('returns false for $label', ({ freeze, value }) => {
    if (freeze) {
      Object.freeze(value);
    }
    expect(StackTrace.isValidFrame(value)).toBeFalse();
  });

  // Correct cases.
  test.each`
  label                   | value
  ${'basic correct case'} | ${{ name: 'x', file: 'x', line: 12, col: 23 }}
  ${'null line'}          | ${{ name: 'x', file: 'x', line: null, col: 23 }}
  ${'null col'}           | ${{ name: 'x', file: 'x', line: 12, col: null }}
  `('returns true for $label', ({ value }) => {
    Object.freeze(value);
    expect(StackTrace.isValidFrame(value)).toBeTrue();
  });
});
