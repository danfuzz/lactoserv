// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { inspect, types } from 'node:util';

import { AskIf, MustBe } from '@this/typey';

import { BaseCodec } from '#x/BaseCodec';
import { CodecConfig } from '#x/CodecConfig';
import { Ref } from '#x/Ref';
import { Sexp } from '#x/Sexp';


// TODO: Handle self-referential structures.

// TODO: Is there a sane way to know if an array is non-sparse and has no extra
// properties? If so, it might be more efficient to iterate directly over such
// arrays, as opposed to using `Object.entries()` and the like.

/**
 * Primary concrete implementation of the {@link BaseCodec} protocol. See the
 * module `README.md` for a bit more detail.
 */
export class Codec extends BaseCodec {
  /**
   * Configuration to use.
   *
   * @type {CodecConfig}
   */
  #config;

  /**
   * Constructs an instance.
   *
   * @param {?CodecConfig} config Configuration to use, or `null` to use the
   *   default configuration.
   */
  constructor(config = null) {
    super();

    this.#config = (config === null)
      ? new CodecConfig()
      : MustBe.instanceOf(config, CodecConfig);
  }

  /** @override */
  decode(data) {
    throw BaseCodec.decodingUnimplemented(data);
  }

  /** @override */
  encode(value) {
    const result = this.#encode0(value);

    return (result === BaseCodec.OMIT)
      ? undefined
      : result;
  }

  /**
   * Helper for {@link #encode}, which performs content encoding on data
   * instances.
   *
   * @param {*} orig Value to convert.
   * @returns {*} The converted version.
   */
  #encodeDataInstance(orig) {
    const freeze   = this.#config.freeze;
    const toEncode = orig.toEncodableValue();

    if (freeze) {
      Object.freeze(toEncode);
    }

    const replacement = this.#encode0(toEncode);

    if ((replacement === toEncode) && (freeze === Object.isFrozen(orig))) {
      return orig;
    } else {
      const result = orig.withEncodedValue(replacement);
      if (freeze) {
        Object.freeze(result);
      }
      return result;
    }
  }

  /**
   * Helper for {@link #encode}, which does most of the work and is also the
   * recursive re-entry point for the conversion procedure.
   *
   * @param {*} orig Value to convert.
   * @returns {*} The converted version.
   */
  #encode0(orig) {
    const config = this.#config;

    switch (typeof orig) {
      case 'bigint':
      case 'boolean':
      case 'number':
      case 'string':
      case 'symbol':
      case 'undefined': {
        return orig;
      }

      case 'function': {
        if (types.isProxy(orig)) {
          return this.#performReplacement(orig, config.proxyAction);
        } else {
          return this.#performReplacement(orig, config.functionAction);
        }
      }

      case 'object': {
        if (orig === null) {
          return null;
        } else if (types.isProxy(orig)) {
          return this.#performReplacement(orig, config.proxyAction);
        } else if (Array.isArray(orig)) {
          return this.#objectOrArrayToData(orig, true);
        } else if (AskIf.plainObject(orig)) {
          return this.#objectOrArrayToData(orig, false);
        } else if (config.isDataInstance(orig)) {
          return this.#encodeDataInstance(orig);
        }

        if (config.specialCases) {
          const replacement = config.specialCases.encode(orig);
          if (replacement !== BaseCodec.UNHANDLED) {
            return this.#encode0(replacement);
          }
        }

        if (config.honorEncodeMethod && orig[BaseCodec.ENCODE]) {
          const replacement = orig[BaseCodec.ENCODE]();
          return this.#encode0(replacement);
        } else if (config.honorDeconstructMethod && orig.deconstruct) {
          const replacement = new Sexp(...orig.deconstruct());
          return this.#encode0(replacement);
        } else {
          return this.#performReplacement(orig, config.instanceAction);
        }
      }
    }

    // JavaScript added a new type after this code was written!
    throw new Error(`Unrecognized \`typeof\` result: ${typeof orig}`);
  }

  /**
   * Helper for {@link #encode0}, which performs conversion of arrays and plain
   * objects.
   *
   * @param {*} orig Value to convert.
   * @param {boolean} isArray Is `orig` an array?
   * @returns {*} The converted version.
   */
  #objectOrArrayToData(orig, isArray) {
    const config = this.#config;

    if (   (config.symbolKeyAction === 'error')
        && (Object.getOwnPropertySymbols(orig).length !== 0)) {
      throw new Error(`Encountered symbol key in ${isArray ? 'array' : 'object'}.`);
    }

    // Note: The `Array()` form is needed in case `orig` is a sparse array with
    // unbound indices at the end.
    const result  = isArray ? Array(orig.length) : {};
    let anyChange = false;

    for (const [key, value] of Object.entries(orig)) {
      const newValue = this.#encode0(value);
      anyChange ||= (value !== newValue);
      switch (newValue) {
        case BaseCodec.OMIT: {
          // Do nothing.
          break;
        }
        case BaseCodec.UNHANDLED: {
          // Induce "unhandled contagion:" The whole conversion is unhandled if
          // any individual item is.
          return BaseCodec.UNHANDLED;
        }
        default: {
          result[key] = newValue;
          break;
        }
      }
    }

    if (config.freeze) {
      return (anyChange || !Object.isFrozen(orig))
        ? Object.freeze(result)
        : orig;
    } else {
      if (Object.isFrozen(orig) || (Object.getOwnPropertySymbols(orig).length !== 0)) {
        // It is a "change" in that the result we return omits symbol-keyed
        // properties or is intentionally not-frozen.
        anyChange = true;
      }
      return anyChange ? result : orig;
    }
  }

  /**
   * Helper for {@link #encode0}, which performs a replacement action as defined
   * by one of the configured actions.
   *
   * @param {*} orig Value to convert.
   * @param {string|function(*): *} action The action option value to use.
   * @returns {*} The converted version.
   */
  #performReplacement(orig, action) {
    switch (action) {
      case 'error':     throw new Error('Encountered non-data.');
      case 'inspect':   return inspect(orig, Codec.#INSPECT_OPTIONS);
      case 'omit':      return BaseCodec.OMIT;
      case 'asObject':  return this.#objectOrArrayToData(orig, false);
      case 'unhandled': return BaseCodec.UNHANDLED;
      case 'wrap':      return new Ref(orig);
      case 'name': {
        if (typeof orig === 'function') {
          const rawName = orig.name;
          const name    = ((typeof rawName === 'string') && (rawName !== '')) ? rawName : '<anonymous>';
          return AskIf.constructorFunction(orig)
            ? `class ${name}`
            : `${name}()`;
        } else if (AskIf.plainObject(orig)) {
          return `object {...}`;
        } else {
          const rawName = orig.constructor?.name;
          const name    = ((typeof rawName === 'string') && (rawName !== '')) ? rawName : '<anonymous>';
          return `${name} {...}`;
        }
      }
      default: {
        // `?? null` to make the call be a function (not method) call.
        const replacement = (action ?? null)(orig);
        return this.#encode0(replacement);
      }
    }
  }


  //
  // Static members
  //

  /**
   * Inspection options for `inspect` actions.
   *
   * @type {object}
   */
  static #INSPECT_OPTIONS = Object.freeze({
    depth:       10,
    breakLength: 120,
    compact:     2,
    getters:     true
  });
}
