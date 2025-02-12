// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { types } from 'node:util';

import { AskIf } from '@this/typey';


/**
 * Minimal `inspect`-like utilities.
 */
export class Inspecty {
  /**
   * Determines a "label" for the given value, in a standardized way, meant to
   * be suggestive (to a human) of what type of value it is as well. For
   * anything but objects, functions and symbols, this returns the string form
   * of the given value unless it would be empty. Beyond that, it makes
   * reasonable efforts to find a name and suggestive label, also marking
   * proxies explicitly as such. This can be thought of, approximately, as a
   * minimalistic form of `util.inspect()`.
   *
   * @param {*} value Value to figure out the label of.
   * @returns {string} The label.
   */
  static labelFromValue(value) {
    const proxyWrapIfNecessary = (name) => {
      return types.isProxy(value) ? `Proxy {${name}}` : name;
    };

    switch (typeof value) {
      case 'function': {
        const rawName   = value.name;
        const basicName = ((typeof rawName === 'string') && (rawName !== '')) ? rawName : '<anonymous>';
        const name      = AskIf.callableFunction(value)
          ? `${basicName}()`
          : `class ${basicName}`;
        return proxyWrapIfNecessary(name);
      }

      case 'object': {
        if (value === null) {
          return 'null';
        } else if (AskIf.plainObject(value)) {
          if (typeof value.name === 'string') {
            return proxyWrapIfNecessary(`${value.name} {...}`);
          } else {
            return proxyWrapIfNecessary('object {...}');
          }
        } else if (typeof value.constructor === 'function') {
          const rawClassName    = value.constructor?.name;
          const className       = ((typeof rawClassName === 'string') && (rawClassName !== '')) ? rawClassName : '<anonymous>';
          const rawInstanceName = value.name ?? null;
          const instanceName    = ((typeof rawInstanceName === 'string') && (rawInstanceName !== '')) ? ` ${rawInstanceName}` : '';
          return proxyWrapIfNecessary(`${className}${instanceName} {...}`);
        } else {
          return proxyWrapIfNecessary('<anonymous> {...}');
        }
      }

      case 'string': {
        return (value === '') ? '<anonymous>' : value;
      }

      case 'symbol': {
        return `symbol {${value.description}}`;
      }

      default: {
        return `${value}`;
      }
    }
  }

  /**
   * Determines a "name" for the given value, in a standardized way. For
   * anything but objects or functions, this returns the simple string form of
   * the given value unless it would be empty. Beyond that, it makes reasonable
   * efforts to find a name in the usual ways one might expect.
   *
   * @param {*} value Value to figure out the name of.
   * @returns {string} The name.
   */
  static nameFromValue(value) {
    switch (typeof value) {
      case 'function':
      case 'object': {
        if (value === null) {
          return 'null';
        }

        const rawName = value.name;
        return ((typeof rawName === 'string') && (rawName !== ''))
          ? rawName
          : '<anonymous>';
      }

      case 'string': {
        return (value === '') ? '<anonymous>' : value;
      }

      case 'symbol': {
        return value.description;
      }

      default: {
        return `${value}`;
      }
    }
  }
}
