// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

import { MustBe } from '@this/typey';

import * as util from 'node:util';

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

  /** {boolean} Operate asynchronously? */
  #doAsync;

  /**
   * {{then: function(function(*), function(*))}[]} Array of promises /
   * `then`ables that need resolution.
   */
  #promises = [];

  /**
   * Constructs an instance.
   *
   * @param {*} value Value to be worked on.
   * @param {boolean} doAsync Operate asynchronoulsy?
   */
  constructor(value, doAsync) {
    this.#originalValue = value;
    this.#doAsync = doAsync;
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
   * Adds a pending promise / `then`able.
   *
   * @param {{then: function(function(*), function(*))}} promise Promise to add.
   */
  addPromise(promise) {
    if (!this.#doAsync) {
      throw new Error('Not being run asynchronously.');
    }

    this.#promises.push(promise);
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
   * Performs the expansion synchronously.
   *
   * @returns {*} The result of expansion.
   * @throws {Error} Thrown if there was any trouble during expansion.
   */
  process() {
    const subProcess =
      (pass, path, value) => this.#process0(subProcess, pass, path, value);
    let value = this.#originalValue;

    for (let pass = 1; pass <= 2; pass++) {
      const result = subProcess(pass, [], value);
      if (result.replace !== undefined) {
        value = result.replace;
      } else if (result.same) {
        // Nothing to do here.
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    return value;
  }

  /**
   * Performs the main work of expansion.
   *
   * @param {function()} subProcess Function to call to recursively process.
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}. Will not return `{ delete }`,
   *   `{ replace...await }`, or `{ replace...outer }`.
   */
  #process0(subProcess, pass, path, value) {
    const origValue = value;
    let   result    = null;

    for (;;) {
      if ((value === null) || (typeof value !== 'object')) {
        result = { same: true };
        break;
      } else if (value instanceof Array) {
        result = this.#process0Array(subProcess, pass, path, value);
      } else {
        result = this.#process0Object(subProcess, pass, path, value);
      }

      if (result.iterate === undefined) {
        break;
      }

      value = result.iterate;
    }

    if (result.delete || result.replace?.outer) {
      return result;
    }

    if (result.replace !== undefined) {
      value = result.replace;
    }

    return (value === origValue) ? { same: true } : { replace: value };
  }

  /**
   * Performs the work of {@link #process0}, specifically for arrays.
   *
   * @param {function()} subProcess Function to call to recursively process.
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}, plus `{ iterate: <value>, async:
   *   <boolean> }` to help implement outer replacements. Will not return
   *   `{ delete }` or `{ replace...outer }`.
   */
  #process0Array(subProcess, pass, path, value) {
    const newValue    = [];
    let   allSame     = true;
    let   outerResult = null;

    for (let i = 0; i < value.length; i++) {
      const origValue = value[i];
      const result    = subProcess(pass, [...path, i], origValue);
      MustBe.object(result);

      if (result.delete) {
        allSame = false;
      } else if (result.replace !== undefined) {
        if (result.outer) {
          if (outerResult) {
            throw new Error('Conflicting outer replacements.');
          }
          outerResult = { iterate: result.replace, await: !!result.await };
        } else {
          newValue.push(result.replace);
        }
        allSame = false;
      } else if (result.same) {
        newValue.push(origValue);
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    if (outerResult) {
      return outerResult;
    } else {
      return allSame ? { same: true } : { replace: newValue };
    }
  }

  /**
   * Performs the work of {@link #process0}, specifically for non-array objects.
   *
   * @param {function()} subProcess Function to call to recursively process.
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}, plus `{ iterate: <value>, async:
   *   <boolean> }` to help implement outer replacements. Will not return
   *   `{ delete }` or `{ replace...outer }`.
   */
  #process0Object(subProcess, pass, path, value) {
    const newValue    = {};
    let   allSame     = true;
    let   outerResult = null;

    // Go over all bindings, processing them as values (ignoring directiveness).
    for (const key of Object.keys(value)) {
      const origValue = value[key];
      const result    = subProcess(pass, [...path, key], origValue);
      MustBe.object(result);

      if (result.delete) {
        allSame = false;
      } else if (result.replace !== undefined) {
        if (result.outer) {
          if (outerResult) {
            throw new Error('Conflicting outer replacements.');
          }
          outerResult = { iterate: result.replace, await: !!result.await };
        } else {
          newValue[key] = result.replace;
        }
        allSame = false;
      } else if (result.same) {
        newValue[key] = origValue;
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    if (outerResult) {
      return outerResult;
    }

    // See if the post-processing result contains any directives. If so, then
    // either run it (if there's exactly one) or complain (if there's more than
    // one).

    let directiveName = null;
    let directive     = null;

    for (const key of Object.keys(newValue)) {
      const d = this.#directives.get(key);
      if (d) {
        if (directive !== null) {
          throw new Error(`Multiple directives: ${directiveName} and ${key} (and maybe more).`);
        }
        directiveName = key;
        directive     = d;
      }
    }

    if (directive) {
      const result = directive.process(
        pass, [...path, directiveName], newValue[directiveName]);

      if (result.delete) {
        delete newValue[directiveName];
        allSame = false;
      } else if (result.replace !== undefined) {
        if (result.outer) {
          return { iterate: result.replace, await: !!result.await }
        }
        newValue[directiveName] = result.replace;
        allSame = false;
      } else if (result.same) {
        // Nothing to do here.
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    return allSame ? { same: true } : { replace: newValue };
  }

  /**
   * Awaits all pending promises.
   */
  async #resolveAllPromises() {
    // This arrangement is meant to ensure that parallel calls to this method
    // don't mess each other up and all eventually complete.
    while (this.#promises.length !== 0) {
      const item = this.#promises[this.#promises.length - 1];
      await item;
      if (this.#promises[this.#promises.length - 1]) {
        this.#promises.pop();
      }
    }
  }
}
