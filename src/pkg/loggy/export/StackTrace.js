// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { AskIf, MustBe } from '@this/typey';


/**
 * Utility class for generating and manipulating stack traces.
 *
 * **Note:** This class is written to expect Node / V8 stack traces.
 */
export class StackTrace {
  /**
   * @type {{ name: ?string, file: string, line: ?number, col: ?number }[]} The
   * frames of the stack trace.
   */
  #frames;

  /**
   * Constructs an instance, either from the current call, or from another
   * stack-trace-containing item (an instance of this class, an instance of an
   * `Error`-like object, or an array of objects as if produced by {@link
   * #framesNow} or {@link #framesFrom}).
   *
   * **Note:** This constructor's signature is effectively `([original],
   * [omitCount, [maxCount]])`. That is, `original` does not have to be passed
   * at all, even if passing the later arguments.
   *
   * @param {string|StackTrace|{ message: string, stack: string }|{ name:
   *   ?string, file: string, line: ?number, col: ?number }[]} [original = null]
   *   Source for the stack frames. If passed as `null` or omitted, this
   *   constructs an instance based on the current call (to this constructor),
   *   with the actual call to this method omitted from the result.
   * @param {number} [omitCount = 0] The number of innermost stack frames to
   *   omit.
   * @param {?number} [maxCount = null] Maximum number of frames to include, or
   *   `null` to have no limit.
   */
  constructor(original = null, omitCount, maxCount) {
    // Deal with the variadic nature of this method.
    if ((typeof original !== 'object') && (typeof original !== 'string')) {
      maxCount = omitCount;
      omitCount = original;
      original = null;
    }

    omitCount ??= 0;
    maxCount ??= Number.POSITIVE_INFINITY;

    if (original === null) {
      // `this.constructor` because of the call to `_impl_newError()` which can
      // be overridden in a subclass.
      this.#frames = this.constructor.framesNow(omitCount + 1, maxCount);
    } else {
      this.#frames = StackTrace.framesFrom(original, omitCount, maxCount);
    }
  }

  /**
   * @type {{ name: ?string, file: string, line: ?number, col: ?number }[]}
   * Array of stack frames.
   */
  get frames() {
    return this.#frames;
  }

  /**
   * Gets a replacement value for this instance, which is suitable for JSON
   * serialization.
   *
   * **Note:** This method is named as such (as opposed to the more
   * standard-for-this-project `toJSON`), because the standard method
   * `JSON.stringify()` looks for methods of this name to provide custom JSON
   * serialization.
   *
   * @returns {object} The JSON-serializable form.
   */
  toJSON() {
    return this.#frames;
  }


  //
  // Static members
  //

  /**
   * Gets a stack frame array from a source of stack frames (the same options as
   * are available in this class's constructor). Each element of the result
   * represents a single stack frame. The result is a simple compound object,
   * not an instance of this class. The result is always deeply frozen.
   *
   * **Note:** The result only represents the direct stack of the `Error`, not
   * any error(s) referenced via `.cause`.
   *
   * @param {string|StackTrace|{ message: string, stack: string }|{ name:
   *   ?string, file: string, line: ?number, col: ?number }[]} original Source
   *   for the stack frames.
   * @param {number} [omitCount = 0] Number of innermost stack frames to omit
   *   (not including the one for this method call, which is _always_ omitted).
   * @param {?number} [maxCount = null] Maximum number of frames to include, or
   *   `null` to have no limit.
   * @returns {{ name: ?string, file: string, line: ?number, col: ?number }[]}
   *   The stack trace.
   */
  static framesFrom(original, omitCount = 0, maxCount = null) {
    maxCount ??= Number.POSITIVE_INFINITY;

    if (original instanceof StackTrace) {
      const frames = original.#frames;
      return ((omitCount === 0) && (frames.length <= maxCount))
        ? frames
        : Object.freeze(frames.slice(omitCount, omitCount + maxCount));
    } else if (Array.isArray(original)) {
      const frames = ((omitCount === 0) && (original.length <= maxCount))
        ? original
        : Object.freeze(original.slice(omitCount, omitCount + maxCount));
      return StackTrace.#framesFromArray(frames);
    }

    const stack   = (typeof original === 'string') ? original : original.stack;
    const result  = [];

    // This matches a single stack frame line, in Node / V8 format.
    const lineRx = /    at ([^()\n]+)(?: [(]([^()\n]*)[)])?(\n|$)/gy;
    lineRx.lastIndex = StackTrace.#findFirstFrame(original);

    while (result.length < maxCount) {
      const foundLine = lineRx.exec(stack);
      if (foundLine === null) {
        break;
      } else if (omitCount-- > 0) {
        continue;
      }

      const fileEtc  = foundLine[2] ?? foundLine[1];
      const name     = (fileEtc === foundLine[1]) ? '<none>' : foundLine[1];
      const foundPos = fileEtc.match(/^(.*?)(?::([0-9]+))(?::([0-9]+))?/);
      const file     = foundPos ? foundPos[1] : fileEtc;
      const line     = foundPos ? parseInt(foundPos[2]) : null;
      const col      = foundPos ? parseInt(foundPos[3]) : null;

      result.push(Object.freeze({ name, file, line, col }));
    }

    return Object.freeze(result);
  }

  /**
   * Gets a stack frame array for a trace representing the current call, minus
   * the given number of innermost frames (not including the call to this
   * method, which is always omitted), and optionally of with specified maximum
   * number of frames. Each element of the result represents a single stack
   * frame. The result is a simple compound object, not an instance of this
   * class. The result is always deeply frozen.
   *
   * @param {number} [omitCount = 0] Number of innermost stack frames to omit
   *   (not including the one for this method call, which is _always_ omitted).
   * @param {?number} [maxCount = null] Maximum number of frames to include, or
   *   `null` to have no limit.
   * @returns {{ name: ?string, file: string, line: ?number, col: ?number }[]}
   *   The stack trace.
   */
  static framesNow(omitCount = 0, maxCount = null) {
    omitCount += 2; // To skip the frame for this call and `_impl_newError()`.
    maxCount ??= Number.POSITIVE_INFINITY;

    // This regex matches Node / V8 stack traces. Other than the first line of
    // `Error` (no-message instance), each line is expected to either be a
    // file/location ID or a function/method ID followed by a file/location ID
    // in parentheses.
    const lineRx = /(?:Error\n)?    at ([^()\n]+)(?: [(]([^()\n]*)[)])?(\n|$)/gy;

    const raw    = this._impl_newError().stack;
    const result = [];

    while (result.length < maxCount) {
      const foundLine = lineRx.exec(raw);
      if (foundLine === null) {
        break;
      } else if (omitCount-- > 0) {
        continue;
      }

      const fileEtc  = foundLine[2] ?? foundLine[1];
      const name     = (fileEtc === foundLine[1]) ? '<none>' : foundLine[1];
      const foundPos = fileEtc.match(/^(.*?)(?::([0-9]+))(?::([0-9]+))?/);
      const file     = foundPos ? foundPos[1] : fileEtc;
      const line     = foundPos ? parseInt(foundPos[2]) : null;
      const col      = foundPos ? parseInt(foundPos[3]) : null;

      result.push(Object.freeze({ name, file, line, col }));
    }

    return Object.freeze(result);
  }

  /**
   * Indicates whether the given value is a valid frame object. This is mostly
   * useful for testing.
   *
   * @param {*} value Arbitrary value.
   * @returns {boolean} `true` iff `value` is valid as-is as a stack frame
   *   object as used in this class.
   */
  static isValidFrame(value) {
    if (!(   AskIf.plainObject(value)
          && Object.isFrozen(value)
          && (Object.getOwnPropertyNames(value).length === 4))) {
      return false;
    }

    const { name, file, line, col } = value;

    return (typeof name === 'string')
      && (typeof file === 'string')
      && ((line === null) || (typeof line === 'number'))
      && ((col === null) || (typeof col === 'number'));
  }

  /**
   * Constructs a new `Error` instance with no message. This method exists
   * solely so that a testing-only subclass can be made which can control the
   * generated stack trace.
   *
   * @returns {Error} A new instance.
   */
  static _impl_newError() {
    return new Error();
  }

  /**
   * Finds the index into the stack string of the first stack frame line, given
   * either a stack string per se or an `Error`-like object.
   *
   * @param {{ message: string, stack: string }|string} errorOrStack The
   *   `Error`-like instance or stack string to extract a structured stack trace
   *   from.
   * @returns {number} Index for the first stack frame line.
   */
  static #findFirstFrame(errorOrStack) {
    if (typeof errorOrStack === 'string') {
      return StackTrace.#findFirstFrameFromStackString(errorOrStack);
    }

    const name = errorOrStack?.constructor?.name ?? null;
    if (name === null) {
      throw new Error('Not an Error-like object.');
    }

    const { message = null, stack = null } = errorOrStack;

    if ((typeof message !== 'string') || (typeof stack !== 'string')) {
      throw new Error('Not an Error-like object.');
    }

    // If `.stack` starts as would be expected, trust that the frames
    // immediately follow. But if not, fall back on the string-only heuristics.
    const expectStart = `${name}${message === '' ? '' : ': '}${message}\n`;
    return stack.startsWith(expectStart)
      ? expectStart.length
      : StackTrace.#findFirstFrameFromStackString(stack);
  }

  /**
   * Helper for {@link #findFirstFrame}, when we only have a string stack trace
   * to base things on.
   *
   * Since we don't have a type and message to look for, the best we can do is
   * find the first line that looks like a frame, after which there are no other
   * lines that _don't_ look like frames. And "looks like a frame" is really a
   * pretty basic test because there's a lot of leeway in terms of what actually
   * ends up on a frame line.
   *
   * @param {string} stack The string stack trace form.
   * @returns {number} Index for the first stack frame line.
   */
  static #findFirstFrameFromStackString(stack) {
    const framesMatch = /(\n    at [^\n]+)+$/.exec(stack);

    if (framesMatch === null) {
      throw new Error('Not a stack trace string.');
    }

    // `+1` because the match starts at the newline before the first frame line.
    return framesMatch.index + 1;
  }

  /**
   * Helper for {@link #framesFromArray}, which makes a frame from an arbitrary
   * object.
   *
   * @param {*} orig The original object.
   * @returns {object} A valid frame object, possibly `orig`.
   */
  static #frameFromObject(orig) {
    const extract = () => {
      const { name, file, line, col } = orig;
      return { name, file, line, col };
    };

    let frame = (AskIf.plainObject(orig) && Object.isFrozen(orig))
      ? orig
      : extract();

    MustBe.string(frame.name);
    MustBe.string(frame.file);
    if (frame.line !== null) MustBe.number(frame.line);
    if (frame.col !== null) MustBe.number(frame.col);

    if (Object.isFrozen(frame)) {
      if (Object.getOwnPropertyNames(frame).length === 4) {
        return frame;
      }
      // Unusual but we'll deal: `orig` seems to be a valid frame object as-is
      // except that it has extra properties.
      frame = extract();
    }

    return Object.freeze(frame);
  }

  /**
   * Constructs a known-valid frames array from a possibly-valid one.
   *
   * @param {*[]} original Original value.
   * @returns {object[]} Frame array, in the form expected by the rest of this
   *   class.
   */
  static #framesFromArray(original) {
    // Optimistic assumption to begin with, but might be revised!
    let result = original;

    for (let i = 0; i < result.length; i++) {
      const frame = this.#frameFromObject(result[i]);
      if (frame !== result[i]) {
        if (Object.isFrozen(result)) {
          result = [...result];
        }
        result[i] = Object.freeze(frame);
      }
    }

    return result;
  }
}
