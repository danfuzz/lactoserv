// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ErrorCodec } from '#p/ErrorCodec';
import { SpecialCodecs } from '#x/SpecialCodecs';


/**
 * Utility class that knows all the standard special-case converters.
 */
export class StandardConverters {
  /**
   * Standard instance, if initialized.
   *
   * @type {?SpecialCodecs}
   */
  static #STANDARD;

  /**
   * Standard logging instance, if initialized.
   *
   * @type {?SpecialCodecs}
   */
  static #STANDARD_FOR_LOGGING;

  /** @returns {SpecialCodecs} Standard instance. */
  static get STANDARD() {
    this.#STANDARD ??= this.#makeStandard();
    return this.#STANDARD;
  }

  /** @returns {SpecialCodecs} Standard logging instance. */
  static get STANDARD_FOR_LOGGING() {
    this.#STANDARD_FOR_LOGGING ??= this.#makeStandardForLogging();
    return this.#STANDARD_FOR_LOGGING;
  }

  /**
   * Makes the value for {@link #STANDARD}.
   *
   * @returns {SpecialCodecs} The instance.
   */
  static #makeStandard() {
    const std = new SpecialCodecs();

    std.addForErrors(new ErrorCodec());

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
   * @returns {SpecialCodecs} The instance.
   */
  static #makeStandardForLogging() {
    const std = new SpecialCodecs();

    std.addForErrors(new ErrorCodec(true));
    std.addDefaults(this.STANDARD);

    std.freeze();
    return std;
  }
}
