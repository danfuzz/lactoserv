// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { Sexp } from '#x/Sexp';
import { StackTrace } from '#x/StackTrace';


/**
 * Special-case converter for instances of `Error` including subclasses.
 *
 * **Note:** Subclasses have to be registered with this module explicitly in
 * order to be converted from instances to data.
 */
export class ConvError extends BaseConverter {
  /**
   * Should stacks be parsed?
   *
   * @type {boolean}
   */
  #parseStacks;

  /**
   * Constructs an instance.
   *
   * @param {boolean} [parseStacks] Should stacks be parsed? If so, the `stack`
   *   property of encoded instances will, when possible, contain an (encoded)
   *   instance of {@link StackTrace}.
   */
  constructor(parseStacks = false) {
    super();

    this.#parseStacks = MustBe.boolean(parseStacks);
  }

  /** @override */
  decode(data) {
    throw BaseConverter.decodingUnimplemented(data);
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

    return new Sexp(type, rest, main);
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
