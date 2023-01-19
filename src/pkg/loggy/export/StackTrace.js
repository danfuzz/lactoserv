// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { AskIf, MustBe } from '@this/typey';


/**
 * Utility class for generating stack traces.
 */
export class StackTrace {
  /**
   * @type {{ name: ?string, file: string, line: ?number, col: ?number }[]} The
   * frames of the stack trace.
   */
  #frames;

  /**
   * Constructs an instance, either from the current call or another stack trace
   * (an instance of this class or an array as if produced by {@link #make}).
   *
   * If producing a new trace, the two arguments are `omitCount` to indicate the
   * number of innermost frames to omit (not including the call to the
   * constructor, which is never included) and `maxCount` to indicate the
   * maximum number of frames to include. Both arguments are optional.
   *
   * If basing this instance on another trace, the two arguments are `original`
   * to indicate the original trace and `maxCount` to indicate the maximum
   * number of frames to include. `maxCount` is optional.
   *
   * @param {number|StackTrace|{ name: ?string, file: string, line: ?number,
   *   col: ?number }[]} [omitCountOrOriginal = 0] Either the number of frames
   *   to omit, or the original trace to base this instance on.
   * @param {?number} [maxCount = null] Maximum number of frames to include, or
   *   `null` to have no limit.
   */
  constructor(omitCountOrOriginal = 0, maxCount = null) {
    maxCount ??= Number.POSITIVE_INFINITY;

    if (typeof omitCountOrOriginal === 'number') {
      this.#frames = this.constructor.framesNow(omitCountOrOriginal + 1, maxCount);
    } else if (omitCountOrOriginal instanceof StackTrace) {
      const frames = omitCountOrOriginal.#frames;
      this.#frames = (frames.length <= maxCount)
        ? frames
        : Object.freeze(frames.slice(0, maxCount));
    } else if (Array.isArray(omitCountOrOriginal)) {
      this.#frames = StackTrace.framesFromArray(omitCountOrOriginal, maxCount);
    } else {
      throw new Error('Invalid original stack trace value.');
    }
  }

  /**
   * @type {{ name: ?string, file: string, line: ?number, col: ?number }[]}
   * Array of stack frames.
   */
  get frames() {
    return this.#frames;
  }


  //
  // Static members
  //

  /**
   * Gets a stack frame array for a trace representing the current call, minus
   * the given number of innermost frames. Each element of the result represents
   * a single stack frame. The result is a simple compound object, not an
   * instance of this class. The result is always deeply frozen.
   *
   * @abstract
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
   * @returns {boolean} `true` iff `value` is valid as-is as a stack frame.
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
   * Constructs a known-valid frames array from a possibly-valid one.
   *
   * @param {*[]} orig Original value.
   * @param {number} maxCount Maximum number of frames to include.
   * @returns {object[]} Frame array, in the form expected by the rest of this
   *   class.
   */
  static #framesFromArray(orig, maxCount) {
    let result = (Object.isFrozen(orig) && (orig.length <= maxCount))
      ? orig // Optimistic assumption to begin with, but might be revised!
      : orig.slice(0, maxCount);

    for (let i = 0; i < result.length; i++) {
      const frame = this.#frameFromObject(result[i]);
      if (frame !== result[i]) {
        if (Object.isFrozen(result)) {
          result = [...orig];
        }
        result[i] = Object.freeze(frame);
      }
    }

    return result;
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
}
