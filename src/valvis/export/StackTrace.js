// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfDeconstructable, Sexp } from '@this/sexp';
import { AskIf, MustBe } from '@this/typey';

import { StackFrame } from '#x/StackFrame';


/**
 * Representation of stack traces, along with utility for generating them from
 * various sources.
 *
 * **Note:** This class is written to expect Node / V8 stack traces. And with
 * that as context, V8 exposes facilities to manipulate stack traces in a form
 * more structured than strings, which at first blush seems like a very
 * attractive thing to do. Unfortunately, though, the nature of this class is
 * that at least _sometimes_ it has to deal with already-formatted stack trace
 * strings, so it's not like that stuff could just get dropped; it's more like
 * there would be extra work for minimal (if any) benefit. In any case, see
 * <https://v8.dev/docs/stack-trace-api> for the details on what V8 offers.
 *
 * @implements {IntfDeconstructable}
 */
export class StackTrace extends IntfDeconstructable {
  /**
   * The frames of the stack trace.
   *
   * @type {Array<StackFrame>}
   */
  #frames;

  /**
   * Constructs an instance, either from the current call, or from another
   * stack-trace-containing item (an instance of this class, an instance of an
   * `Error`-like object, or an array of objects as if produced by
   * {@link #framesNow} or {@link #framesFrom}).
   *
   * **Note:** This constructor's signature is effectively `([original],
   * [omitCount, [maxCount]])`. That is, `original` does not have to be passed
   * at all, even if passing the later arguments.
   *
   * @param {string|StackTrace|{ message: string, stack: string }|
   *   Array<StackFrame>} [original] Source for the stack frames. If passed as
   *   `null` or omitted, this constructs an instance based on the current call
   *   (to this constructor), with the actual call to this method omitted from
   *   the result.
   * @param {number} [omitCount] The number of innermost stack frames to omit.
   * @param {?number} [maxCount] Maximum number of frames to include, or `null`
   *   to have no limit.
   */
  constructor(original = null, omitCount, maxCount) {
    super();

    // Deal with the variadic nature of this method.
    if ((typeof original !== 'object') && (typeof original !== 'string')) {
      maxCount = omitCount;
      omitCount = original;
      original = null;
    }

    omitCount ??= 0;
    maxCount ??= Number.POSITIVE_INFINITY;

    if (original === null) {
      // `new.target` because of the call to `_impl_newError()` which can be
      // overridden in a subclass.
      this.#frames = new.target.framesNow(omitCount + 1, maxCount);
    } else {
      this.#frames = StackTrace.framesFrom(original, omitCount, maxCount);
    }
  }

  /**
   * @returns {Array<StackFrame>} Array of stack frames.
   */
  get frames() {
    return this.#frames;
  }

  /** @override */
  deconstruct(forLogging_unused) {
    return new Sexp(this.constructor, this.#frames);
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
   * @param {string|StackTrace|{ message: string, stack: string }|
   *   Array<StackFrame>} original Source for the stack frames.
   * @param {number} [omitCount] Number of innermost stack frames to omit (not
   *   including the one for this method call, which is _always_ omitted).
   * @param {?number} [maxCount] Maximum number of frames to include, or `null`
   *   to have no limit.
   * @returns {Array<StackFrame>} The stack trace.
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

    const stack  = (typeof original === 'string') ? original : original.stack;
    const result = [];

    // This matches a single stack frame line, in Node / V8 format.
    const lineRx = /    at ([^\n]+?)(?: [(]([^\n]*)[)])?(\n|$)/gy;
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
   * @param {number} [omitCount] Number of innermost stack frames to omit (not
   *   including the one for this method call, which is _always_ omitted).
   * @param {?number} [maxCount] Maximum number of frames to include, or `null`
   *   to have no limit.
   * @returns {Array<StackFrame>} The stack trace.
   */
  static framesNow(omitCount = 0, maxCount = null) {
    const error = this._impl_newError();
    return this.framesFrom(error, omitCount + 2, maxCount);
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
    const messageStr  = (message === '') ? '' : `: ${message}`;
    const expectStart = `${name}${messageStr}`;
    if (stack === expectStart) {
      // The "stack" is just the message and without a newline. This can happen
      // in practice with some Node internal methods.
      return expectStart.length;
    } else if (stack.startsWith(`${expectStart}\n`)) {
      return expectStart.length + 1;
    } else {
      return StackTrace.#findFirstFrameFromStackString(stack);
    }
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
    const framesMatch = /(\n    at [^\n]+)+[\n]?$/.exec(stack);

    if (framesMatch === null) {
      // Alas, nothing better to do. If you find yourself looking at this error,
      // perhaps the format has evolved, or perhaps there is some simple tactic
      // that is worth doing (e.g. wrapping the contents) such that the system
      // won't just die due to this problem.
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
   * @param {Array<*>} original Original value.
   * @returns {Array<object>} Frame array, in the form expected by the rest of
   *   this class.
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
