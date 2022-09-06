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

  /** {boolean} Operate asynchronously? */
  #doAsync;

  /** @type {*} Original value being worked on. */
  #originalValue;

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
    let value = this.#originalValue;

    for (let pass = 1; pass <= 2; pass++) {
      const result = this.#process0(pass, [], value);
      if (result.delete) {
        // Odd result, but...uh...ok.
        return null;
      } else if (result.replace !== undefined) {
        value = result.replace;
      } else if (result.replaceOuter !== undefined) {
        throw new Error('Cannot `replaceOuter` at top level.');
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
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}, plus `iterate: <value>` to help implement
   *   outer replacements.
   */
  #process0(pass, path, value) {
    const origValue = value;
    let   result;

    for (;;) {
      if ((value === null) || (typeof value !== 'object')) {
        result = { same: true };
        break;
      } else if (value instanceof Array) {
        result = this.#process0Array(pass, path, value);
        if (result.iterate === undefined) {
          break;
        }
        value = result.iterate;
      } else {
        result = this.#process0Object(pass, path, value);
        if (result.iterate === undefined) {
          break;
        }
        value = result.iterate;
      }
    }

    if (result.delete || (result.replaceOuter !== undefined)) {
      return result;
    } else {
      if (result.replace !== undefined) {
        value = result.replace;
      }
      return (value === origValue) ? { same: true } : { replace: value };
    }
  }

  /**
   * Performs the work of {@link #process0}, specifically for arrays.
   *
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}.
   */
  #process0Array(pass, path, value) {
    const newValue      = [];
    let   allSame       = true;
    let   newOuter      = null;
    let   outerReplaced = false;

    for (let i = 0; i < value.length; i++) {
      const origValue = value[i];
      const result    = this.#process0(pass, [...path, i], origValue);
      MustBe.object(result);

      if (result.delete) {
        allSame = false;
      } else if (result.replace !== undefined) {
        newValue.push(result.replace);
        allSame = false;
      } else if (result.replaceOuter !== undefined) {
        if (outerReplaced) {
          throw new Error('Conflicting outer replacements.');
        }
        newOuter = result.replaceOuter;
        outerReplaced = true;
        allSame = false;
      } else if (result.same) {
        newValue.push(origValue);
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    if (outerReplaced) {
      return { iterate: newOuter };
    } else {
      return allSame ? { same: true } : { replace: newValue };
    }
  }

  /**
   * Performs the work of {@link #process0}, specifically for non-array objects.
   *
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}.
   */
  #process0Object(pass, path, value) {
    const newValue      = {};
    let   allSame       = true;
    let   newOuter      = null;
    let   outerReplaced = false;

    // Go over all values, processing them as values (ignoring directiveness).
    for (const key of Object.keys(value)) {
      const origValue = value[key];
      const result    = this.#process0(pass, [...path, key], origValue);
      MustBe.object(result);

      if (result.delete) {
        allSame = false;
      } else if (result.replace !== undefined) {
        newValue[key] = result.replace;
        allSame = false;
      } else if (result.replaceOuter !== undefined) {
        if (outerReplaced) {
          throw new Error('Conflicting outer replacements.');
        }
        newOuter = result.replaceOuter;
        outerReplaced = true;
        allSame = false;
      } else if (result.same) {
        newValue[key] = origValue;
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    if (outerReplaced) {
      return { iterate: newOuter };
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
        newValue[directiveName] = result.replace;
        allSame = false;
      } else if (result.replaceOuter !== undefined) {
        return { iterate: result.replaceOuter };
      } else if (result.same) {
        // Nothing to do here.
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    return allSame ? { same: true } : { replace: newValue };
  }
}
