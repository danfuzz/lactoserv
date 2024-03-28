// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { AskIf, MustBe } from '@this/typey';

import { BaseDataClass } from '#x/BaseDataClass';


/**
 * Data value that represents a typed (but otherwise fairly free-form) structure
 * of some sort. Instances of this class are commonly used as the "distillate"
 * data of behavior-bearing class instances.
 *
 * Instances of this class react to `Object.freeze()` in an analogous way to how
 * plain arrays and objects do.
 */
export class Struct extends BaseDataClass {
  /**
   * Value representing the type (or class) of the structure.
   *
   * @type {*}
   */
  #type;

  /**
   * Named "options" of the structure.
   *
   * @type {?object}
   */
  #options;

  /**
   * Positional "arguments" of the structure.
   *
   * @type {Array<*>}
   */
  #args;


  /**
   * Constructs an instance.
   *
   * @param {*} type Value representing the type (or class) of the structure.
   * @param {?object} [options] Named "options" of the structure, if any.
   *   If non-`null` and not a frozen plain object, it will get cloned and
   *   frozen. If `null`, becomes a frozen version of `{}` (the empty object).
   * @param {...*} args Positional "arguments" of the structure.
   */
  constructor(type, options, ...args) {
    super();

    this.#type    = type;
    this.#options = Struct.#fixOptions(options);
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
   * @param {Array<*>} args The new arguments.
   */
  set args(args) {
    this.#frozenCheck();
    MustBe.array(args);
    this.#args = Object.freeze([...args]);
  }

  /**
   * @returns {object} Named "options" of the structure, if any. This is always
   * a frozen plain object.
   */
  get options() {
    return this.#options;
  }

  /**
   * Sets the named "options." This is only allowed if this instance is not
   * frozen.
   *
   * @param {object} options The new options.
   */
  set options(options) {
    this.#frozenCheck();
    this.#options = Struct.#fixOptions(options);
  }

  /** @returns {*} Value representing the type (or class) of the structure. */
  get type() {
    return this.#type;
  }

  /**
   * Sets the type. This is only allowed if this instance is not frozen.
   *
   * @param {*} type The new type value.
   */
  set type(type) {
    this.#frozenCheck();
    this.#type = type;
  }

  /** @override */
  toEncodableValue() {
    return [this.#type, this.#options, ...this.#args];
  }

  /**
   * Gets a replacement value for this instance, which is suitable for JSON
   * serialization.
   *
   * The result of this specific method is meant more for human convenience than
   * machine re-interpretation, especially in that there is some ambiguity in
   * the representation (it's not reversible). If you find yourself wanting to
   * write code to parse the output from this, consider figuring out how to get
   * the object(s) in question to be "properly" encoded by this module instead.
   * That said, as of this writing, this method is in fact used to produce the
   * `json` format of system logs; this is _not_ intended to be the long-term
   * solution for that format.
   *
   * **Note:** This method is named as such (as opposed to `toJson`, which would
   * be more usual for this project), because the standard JavaScript method
   * `JSON.stringify()` looks for methods of this specific name to provide
   * custom JSON serialization behavior.
   *
   * @returns {object} The JSON-serializable form.
   */
  toJSON() {
    const args    = this.#args;
    const options = this.#options;
    const type    = this.#fixJsonType();

    const hasStringType = (typeof type === 'string');
    const hasOptions    = (Object.keys(options).length !== 0);
    const hasArgs       = (args.length !== 0);

    if (hasStringType) {
      if (hasOptions && hasArgs) return { [type]: { options, args } };
      else if (hasArgs)          return { [type]: args };
      else                       return { [type]: options };
    } else {
      if (hasOptions && hasArgs) return { '@struct': { type, options, args } };
      else if (hasArgs)          return { '@struct': { type, args } };
      else                       return { '@struct': { type, options } };
    }
  }

  /** @override */
  withEncodedValue(innerValue) {
    return new Struct(...innerValue);
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
      return '[Struct]';
    }

    const innerOptions = Object.assign({}, options, {
      depth: (options.depth === null) ? null : options.depth - 1
    });

    const parts = [
      '@',
      (typeof this.#type === 'string')
        ? this.#type
        : inspect(this.#type, innerOptions),
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

    for (const [key, value] of Object.entries(this.#options)) {
      if (first) {
        first = false;
      } else {
        parts.push(', ');
      }
      parts.push(key, ': ', inspect(value, innerOptions));
    }

    parts.push(' }');
    return parts.join('');
  }

  /**
   * Helper for {@link #toJSON}, which converts {@link #type} to something
   * better, if possible, for conversion to JSON.
   *
   * @returns {*} The JSON-encodable type value.
   */
  #fixJsonType() {
    const type = this.#type;

    if (typeof type === 'string') {
      return type.startsWith('@') ? type : `@${type}`;
    } else if (typeof type === 'function') {
      return `@${type?.name ?? 'anonymous'}`;
    } else {
      return type;
    }
  }

  /**
   * Helper for the setters, to check for frozen-ness and respond accordingly.
   */
  #frozenCheck() {
    if (Object.isFrozen(this)) {
      throw new Error('Cannot modify frozen instance.');
    }
  }

  //
  // Static members
  //

  /**
   * Converts an `options` value passed into the constructor into its proper
   * form.
   *
   * @param {*} options Original options value.
   * @returns {object} The converted form.
   */
  static #fixOptions(options) {
    if (options === null) {
      return Object.freeze({});
    } else if (AskIf.plainObject(options) && Object.isFrozen(options)) {
      return options;
    } else {
      return Object.freeze({ ...options });
    }
  }
}
