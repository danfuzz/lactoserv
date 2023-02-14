// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ConvError } from '#p/ConvError';
import { SpecialConverters } from '#x/SpecialConverters';


/**
 * Utility class that knows all the standard special-case converters.
 */
export class StandardConverters {
  /** @type {?SpecialConverters} Standard instance, if initialized. */
  static #STANDARD;

  /** @type {?SpecialConverters} Standard logging instance, if initialized. */
  static #STANDARD_FOR_LOGGING;

  /** @returns {SpecialConverters} Standard instance. */
  static get STANDARD() {
    this.#STANDARD ??= this.#makeStandard();
    return this.#STANDARD;
  }

  /** @returns {SpecialConverters} Standard logging instance. */
  static get STANDARD_FOR_LOGGING() {
    this.#STANDARD ??= this.#makeStandardForLogging();
    return this.#STANDARD;
  }

  /**
   * Makes the value for {@link #STANDARD}.
   *
   * @returns {SpecialConverters} The instance.
   */
  static #makeStandard() {
    const std = new SpecialConverters();

    std.addForErrors(new ConvError());

    // TODO: More! Good reference:
    // <https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm>

    // std.add(Class, new ConvClass());
    // ...

    std.freeze();
    return std;
  }

  /**
   * Makes the value for {@link #STANDARD_FOR_LOGGING}.
   *
   * @returns {SpecialConverters} The instance.
   */
  static #makeStandardForLogging() {
    const std = new SpecialConverters();

    std.addForErrors(new ConvError(true));
    std.addDefaults(this.STANDARD);

    std.freeze();
    return std;
  }
}
