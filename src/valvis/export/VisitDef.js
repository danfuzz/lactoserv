// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Sexp } from '@this/sexp';

import { BaseDefRef } from '#x/BaseDefRef';
import { VisitRef } from '#x/VisitRef';


/**
 * Representation of a result of a (sub-)visit which appears more than once in
 * an overall visit result.
 */
export class VisitDef extends BaseDefRef {
  /**
   * The value being referred to, or `null` if not yet known.
   *
   * @type {*} value
   */
  #value;

  /**
   * The error resulting from the visit, or `null` if there was none _or_ it is
   * not yet known.
   *
   * @type {?Error}
   */
  #error;

  /**
   * Is the visit finished? Relatedly, are {@link #value} and {@link #error}
   * known?
   *
   * @type {boolean}
   */
  #finished;

  /**
   * This instance's corresponding ref.
   *
   * @type {VisitRef}
   */
  #ref;

  /**
   * Constructs an instance.
   *
   * @param {number} index The reference index number.
   * @param {*} [value] The already-known associated value. If not passed, the
   *   value is treated as not yet known, which relatedly means that the
   *   associated (sub-)visit is not yet finished (generally due to this
   *   instance being created to represent the result of a value that is part of
   *   a reference cycle).
   */
  constructor(index, value) {
    super(index);

    this.#ref   = new VisitRef(this);
    this.#error = null;

    if (arguments.length < 2) {
      this.#value    = null;
      this.#finished = false;
    } else {
      this.#value    = value;
      this.#finished = true;
    }
  }

  /** @override */
  get def() {
    return this;
  }

  /** @override */
  get ref() {
    return this.#ref;
  }

  /** @override */
  get value() {
    if (!this.#finished) {
      throw new Error('Not yet finished.');
    } else if (this.#error) {
      throw this.#error;
    } else {
      return this.#value;
    }
  }

  /** @override */
  deconstruct(forLogging) {
    let valueArgs;

    if (this.#finished) {
      if (this.#error) {
        if (!forLogging) {
          // Can't deconstruct an errored def when _not_ logging, as there's no
          // way to construct such a one.
          this.value; // This will throw.
        }
        valueArgs = ['error', this.#error];
      } else {
        valueArgs = [this.#value];
      }
    } else {
      valueArgs = [];
    }

    return new Sexp(this.constructor, this.index, ...valueArgs);
  }

  /**
   * Indicates that this instance's visit has now finished unsuccessfully with
   * the given error. It is only ever valid to call this on an unfinished
   * instance.
   *
   * @param {Error} error The error.
   */
  finishWithError(error) {
    if (this.#finished) {
      throw new Error('Already finished.');
    }

    this.#finished = true;
    this.#error    = error;
  }

  /**
   * Indicates that this instance's visit has now finished successfully with the
   * given result value. It is only ever valid to call this on an unfinished
   * instance.
   *
   * @param {*} value The result value.
   */
  finishWithValue(value) {
    if (this.#finished) {
      throw new Error('Already finished.');
    }

    this.#finished = true;
    this.#value    = value;
  }

  /** @override */
  isFinished() {
    return this.#finished;
  }

  /**
   * Implementation of the standard `JSON.stringify()` replacement interface.
   *
   * **Note:** This is not intended for high-fidelity data encoding, in that the
   * result is ambiguous with plain objects that happen to have the same shape
   * as this method's results. The main use for this is that this is what Jest
   * uses when printing out equality errors in test cases.
   *
   * @param {?string} key_unused The property name / stringified index where the
   *   instance was fetched from.
   * @returns {*} The replacement form to encode.
   */
  toJSON(key_unused) {
    let valueArg;
    if (this.#finished) {
      valueArg = this.#error
        ? [null, this.#error.message]
        : [this.#value];
    } else {
      valueArg = [];
    }

    return { '@def': [this.index, ...valueArg] };
  }
}
