// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { MustBe } from '@this/typey';


/**
 * Data value that represents a free-form would-be method call (or
 * method-call-like thing). This is more or less equivalent to what is
 * historically sometimes called an "s-expression" or more tersely a "sexp,"
 * hence the name of this class. Instances of this class are commonly used as
 * bearers of "distillate" data of behavior-bearing class instances.
 *
 * Instances of this class react to `Object.freeze()` in an analogous way to how
 * plain arrays and objects do.
 */
export class Sexp {
  /**
   * Value representing the thing-to-be-called when "applying" this instance.
   *
   * @type {*}
   */
  #functor;

  /**
   * Positional "arguments" of the structure.
   *
   * @type {Array<*>}
   */
  #args;

  /**
   * Constructs an instance.
   *
   * @param {*} functor Value representing the thing-that-is-to-be-called.
   * @param {...*} args Positional "arguments" of the structure.
   */
  constructor(functor, ...args) {
    this.#functor = functor;
    this.#args    = Object.freeze(args);
  }

  /**
   * @returns {Array<*>} Positional "arguments" of the structure. This is always
   * a frozen array.
   */
  get args() {
    return this.#args;
  }

  /**
   * Sets the positional "arguments." This is only allowed if this instance is
   * not frozen.
   *
   * **Note:** The contents of `args` are copied into a fresh array on this
   * instance. That is, `this.args = x; return this.args === x;` is `false`.
   *
   * @param {Array<*>} args The new arguments.
   */
  set args(args) {
    this.#frozenCheck();
    MustBe.array(args);
    this.#args = Object.freeze([...args]);
  }

  /**
   * @returns {*} Value representing the thing-to-be-called when "applying" this
   * instance (in some contextually-relevant way). Depending on context, this
   * might be akin to a function, a method name, a class (i.e. a constructor
   * function), or a type of some sort.
   */
  get functor() {
    return this.#functor;
  }

  /**
   * Sets the functor. This is only allowed if this instance is not frozen.
   *
   * @param {*} functor The new functor value.
   */
  set functor(functor) {
    this.#frozenCheck();
    this.#functor = functor;
  }

  /**
   * @returns {string} A reasonably-suggestive "name" for {@link #functor}. If
   * {@link #functor} is a string, then this is that string. Otherwise, if it is
   * a function or object with a string `.name` property, it is that property
   * name. Otherwise, it is `<anonymous>`.
   */
  get functorName() {
    const functor = this.#functor;

    switch (typeof functor) {
      case 'function':
      case 'object': {
        if ((functor === null) || (functor === '')) {
          break;
        }

        const name = functor.name;
        if (typeof name === 'string') {
          return name;
        }

        break;
      }

      case 'string': {
        return functor;
      }
    }

    return '<anonymous>';
  }

  /**
   * Standard iteration protocol. For this class, it iterates over (what would
   * be) the result of a call to {@link #toArray} at the moment this method was
   * called.
   *
   * @yields {*} The functor, followed by any arguments.
   */
  *[Symbol.iterator]() {
    const args = this.#args; // Snapshot, per documented contract.

    yield this.#functor;
    yield* args;
  }

  /**
   * Gets an array form of this instance, of the {@link #functor} followed by
   * any {@link args}.
   *
   * @returns {Array} The array form.
   */
  toArray() {
    return [this.#functor, ...this.#args];
  }

  /**
   * Custom inspector for instances of this class.
   *
   * @param {number} depth Maximum depth to inspect to.
   * @param {object} options Inspection options.
   * @param {Function} inspect Inspector function to use for sub-inspection.
   * @returns {string} The inspected form.
   */
  [util.inspect.custom](depth, options, inspect) {
    if (depth < 0) {
      return '[Sexp]';
    }

    const innerOptions = Object.assign({}, options, {
      depth: (options.depth === null) ? null : options.depth - 1
    });

    const parts = [
      '@',
      (typeof this.#functor === 'string')
        ? this.#functor
        : inspect(this.#functor, innerOptions),
      ' { '
    ];

    let first = true;
    for (const arg of this.#args) {
      if (first) {
        first = false;
      } else {
        parts.push(', ');
      }
      parts.push(inspect(arg, innerOptions));
    }

    parts.push(' }');
    return parts.join('');
  }

  /**
   * Helper for the setters, to check for frozen-ness and respond accordingly.
   */
  #frozenCheck() {
    if (Object.isFrozen(this)) {
      throw new Error('Cannot modify frozen instance.');
    }
  }
}
