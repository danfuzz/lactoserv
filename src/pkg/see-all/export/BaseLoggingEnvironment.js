// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Methods, MustBe } from '@this/typey';


/**
 * Abstract class representing a provider of a "logging environment." This class
 * exists so that the rest of the logging system doesn't have to _directly_
 * depend on system-specific services for getting the time and generating stack
 * traces.
 */
export class BaseLoggingEnvironment {
  // Note: The default constructor is fine here.

  /**
   * Gets a timestamp representing "now," represented as seconds since the
   * Unix Epoch, with microsecond-or-better precision.
   *
   * @abstract
   * @returns {number} "Now" in seconds.
   */
  nowSec() {
    const result = MustBe.number(this._impl_nowSec());

    if (result < BaseLoggingEnvironment.MIN_REASONABLE_NOW_SEC) {
      throw new Error('Too small to be a reasonable timestamp.');
    } else if (result > BaseLoggingEnvironment.MAX_REASONABLE_NOW_SEC) {
      throw new Error('Too large to be a reasonable timestamp.');
    }

    return result;
  }

  /**
   * Gets a stack trace representing the current call, minus the given number
   * of innermost stack frames. Each element of the result represents a single
   * stack frame.
   *
   * @abstract
   * @param {number} [omitCount = 0] Number of innermost stack frames to omit
   *   (not including the one for this method call, which is _always_ omitted).
   * @returns {string[]} The stack trace.
   */
  stackTrace(omitCount = 0) {
    const raw = MustBe.arrayOfString(this._impl_stackTrace());
    const result = [];

    omitCount += 2;
    for (const frame of raw) {
      if (omitCount-- <= 0) {
        continue;
      }
      const frameResult = /^ *(?:at )?(.*)$/.exec(frame);
      if (frameResult) {
        result.push(frameResult[1]);
      } else {
        result.push(`? ${frame}`); // Means we need better parsing of frames.
      }
    }

    return result;
  }

  /**
   * Gets a timestamp representing "now," represented as seconds since the
   * Unix Epoch, with microsecond-or-better precision. This is called by
   * {@link #nowSec}, which sanity-checks the value before returning it.
   *
   * @abstract
   * @returns {number} "Now" in seconds.
   */
  _impl_nowSec() {
    Methods.abstract();
  }

  /**
   * Gets a stack trace representing the current call, including the call to
   * this method. This is called by {@link #stackTrack}, which edits the value
   * (per its contract) before returning it.
   *
   * @abstract
   * @returns {string[]} The stack trace.
   */
  _impl_stackTrace() {
    Methods.abstract();
  }


  //
  // Static members
  //

  /** {number} Lower bound for "reasonable" timestamps. */
  static #MIN_REASONABLE_NOW_SEC = 900_000_000; // The late 1990s.

  /** {number} Upper bound for "reasonable" timestamps. */
  static #MAX_REASONABLE_NOW_SEC = 4_200_000_000; // The early 22nd century.
}
