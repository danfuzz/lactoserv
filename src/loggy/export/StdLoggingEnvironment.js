// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventSource } from '@this/async';
import { WallClock } from '@this/clocks';
import { StackTrace } from '@this/data-values';
import { MustBe } from '@this/typey';

import { BaseLoggingEnvironment } from '#x/BaseLoggingEnvironment';
import { IdGenerator } from '#x/IdGenerator';


/**
 * Standard logging environment, which is hooked up to the "real world."
 */
export class StdLoggingEnvironment extends BaseLoggingEnvironment {
  /** @type {EventSource} Log source attached to {@link #log}. */
  #source;

  /** @type {IdGenerator} ID generator to use. */
  #idGenerator = new IdGenerator();

  /**
   * Constructs an instance.
   *
   * @param {EventSource} source Source to emit events from.
   */
  constructor(source) {
    super();

    this.#source = MustBe.instanceOf(source, EventSource);
  }

  /** @override */
  _impl_logPayload(payload) {
    this.#source.emit(payload);
  }

  /** @override */
  _impl_makeId() {
    return this.#idGenerator.makeId(WallClock.now());
  }

  /** @override */
  _impl_makeStackTrace(omitCount) {
    // `+1` to omit the frame for this method.
    return new StackTrace(omitCount + 1, 4);
  }

  /** @override */
  _impl_now() {
    return WallClock.now();
  }
}
