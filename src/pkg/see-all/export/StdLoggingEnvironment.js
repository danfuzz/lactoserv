// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseLoggingEnvironment } from '#x/BaseLoggingEnvironment';
import { LogSource } from '#x/LogSource';

import { MustBe } from '@this/typey';

import * as process from 'node:process';


/**
 * Standard logging environment, which is hooked up to the "real world."
 */
export class StdLoggingEnvironment extends BaseLoggingEnvironment {
  /** @type {LogSource} Log source attached to {@link #emit}. */
  #source;

  /**
   * Constructs an instance.
   *
   * @param {LogSource} source Source to emit events from.
   */
  constructor(source) {
    super();

    this.#source = MustBe.object(source, LogSource);
  }

  /** @override */
  _impl_emit(record) {
    this.#source.emit(record);
  }

  /** @override */
  _impl_nowSec() {
    const [secs, nanos] = process.hrtime();

    return secs + (nanos * StdLoggingEnvironment.#SECS_PER_NANOSECOND);
  }

  /** @override */
  _impl_stackTrace() {
    return new Error().stack.split('\n').slice(1);
  }


  //
  // Static members
  //

  /** {number} The number of seconds in a nanosecond. */
  static #SECS_PER_NANOSECOND = 1 / 1_000_000_000;
}
