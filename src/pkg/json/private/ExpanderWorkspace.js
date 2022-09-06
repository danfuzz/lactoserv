// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

/**
 * Workspace for running an expansion set up by {@link JsonExpander}, including
 * code to do most of the work (other than what's defined by most directives).
 */
export class ExpanderWorkspace {
  /**
   * @type {Map<string, JsonDirective>} Map from directive names to
   * corresponding directive instances.
   */
  #directives = new Map();

  /** @type {*} Original value being worked on. */
  #originalValue;

  /**
   * Constructs an instance.
   *
   * @param {*} value Value to be worked on.
   */
  constructor(value) {
    this.#originalValue = value;
  }

  /**
   * Adds a directive _instance_.
   *
   * @param {string} name The name of the directive.
   * @param {JsonDirective} directive The directive instance.
   */
  addDirective(name, directive) {
    this.#directives.set(name, directive);
  }

  /**
   * Gets an existing directive _instance_.
   *
   * @param {string} name The name of the directive.
   * @returns {JsonDirective} The directive instance.
   * @throws {Error} Thrown if there is no directive with the given name.
   */
  getDirective(name) {
    const result = this.#directives.get(name);

    if (!result) {
      throw new Error(`No such directive: ${name}`);
    }

    return result;
  }

  /**
   * Performs the expansion.
   *
   * @returns {*} The result of expansion.
   * @throws {Error} Thrown if there was any trouble during expansion.
   */
  process() {
    const pass1Value = this.#process0(1, [], this.#originalValue);
    const pass2Value = this.#process0(2, [], pass1Value);

    return pass2Value;
  }

  /**
   * Performs the main work of expansion.
   *
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {*} Replacement for `value`, or with a `$replaceOuter` form the
   *   replacement for the object that `value` is in, or `undefined` to delete
   *   the property which originally held `value`.
   */
  #process0(pass, path, value) {
    outer: for (;;) {
      if (typeof value !== 'object') {
        return value;
      } else if (value instanceof Array) {
        const newValue = [];
        for (let i = 0; i < value.length; i++) {
          const v = this.#process0(pass, [...path, i], value[i]);
          if (v !== undefined) {
            newValue.push(v);
          }
        }
        return newValue;
      }

      const newValue = {};

      for (const key of Object.keys(value).sort()) {
        const directive = this.#directives.get(key);
        const subPath   = [...path, key];
        let   subValue  = value[key];

        if (directive) {
          subValue = directive.process(pass, subPath, subValue);
          if (subValue?.$replaceOuter) {
            value = subValue.$replaceOuter;
            continue outer;
          }
        }

        subValue = this.#process0(pass, subPath, subValue);
        if (subValue !== undefined) {
          newValue[key] = subValue;
        }
      }

      return newValue;
    }
  }
}
