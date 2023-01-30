// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

/**
 * "Data" value that wraps (or "escapes") a non-data value, allowing it to live
 * undisturbed in a given data-value conversion context.
 *
 * Instances of this class are always frozen.
 */
export class NonData {
  /** @type {*} The wrapped value. */
  #value;

  /**
   * Constructs an instance.
   *
   * @param {*} value The wrapped value.
   */
  constructor(value) {
    this.#value = value;

    Object.freeze(this);
  }

  /** @returns {*} The wrapped value. */
  get value() {
    return this.#value;
  }
}
