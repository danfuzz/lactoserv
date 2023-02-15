// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { StackTrace } from '#x/StackTrace';
import { Struct } from '#x/Struct';


/**
 * Special-case converter for instances of `Error` including subclasses.
 *
 * **Note:** Subclasses have to be registered with this module explicitly in
 * order to be converted from instances to data.
 */
export class ConvError extends BaseConverter {
  /** @type {boolean} Should stacks be parsed? */
  #parseStacks;

  /**
   * Constructs an instance.
   *
   * @param {boolean} [parseStacks = false] Should stacks be parsed? If so,
   *   the `stack` property of encoded instances will, when possible, contain an
   *   (encoded) instance of {@link StackTrace}.
   */
  constructor(parseStacks = false) {
    super();

    this.#parseStacks = MustBe.boolean(parseStacks);
  }

  /** @override */
  decode(data_unused) {
    throw new Error('TODO');
  }

  /** @override */
  encode(value) {
    const { cause, code, message, name } = value;
    const type  = value.constructor;
    const stack = this.#encodeStack(value);
    const rest  = { ...value };
    const main  = {
      name: name ?? type.name ?? 'Error',
      code,
      message: message ?? '',
      stack,
      cause
    };

    delete rest.cause;
    delete rest.code;
    delete rest.message;
    delete rest.name;
    delete rest.stack;

    if (!main.cause) delete main.cause;
    if (!main.code)  delete main.code;
    if (!main.stack) delete main.stack;

    return (Object.entries(rest).length === 0)
      ? new Struct(type, main)
      : new Struct(type, main, rest);
  }

  /**
   * Gets the appropriate value for an encoded `stack` property.
   *
   * @param {Error} error The original error.
   * @returns {*} The value to use in the result for {@link #encode}.
   */
  #encodeStack(error) {
    if (!(this.#parseStacks && (typeof error?.stack === 'string'))) {
      return error.stack;
    }

    return new StackTrace(error);
  }
}
