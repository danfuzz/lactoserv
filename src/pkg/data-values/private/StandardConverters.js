// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ConvError } from '#p/ConvError';
import { SpecialConverters } from '#x/SpecialConverters';

/**
 * Utility class that knows all the standard special-case converters.
 */
export class StandardConverters {
  /** @type {?SpecialConverters} Standard instance, if initialized. */
  static #STANDARD;

  /**
   * @returns {SpecialConverters} Standard instance which covers many built-in
   * JavaScript classes.
   */
  static get STANDARD() {
    this.#STANDARD ??= this.#makeStandardInstance();
    return this.#STANDARD;
  }

  /**
   * Makes the value for {@link #STANDARD}.
   *
   * @returns {SpecialConverters} The instance.
   */
  static #makeStandardInstance() {
    const std = new SpecialConverters();

    std.addForErrors(new ConvError());

    // TODO: More! Good reference:
    // <https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm>

    // std.add(Class, new ConvClass());
    // ...

    std.freeze();

    return std;
  }
}
