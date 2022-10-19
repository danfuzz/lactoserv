// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as util from 'node:util';

import { Methods, MustBe } from '@this/typey';

import { BaseProxyHandler } from '#x/BaseProxyHandler';


/** {Set<string>} Set of methods which never get proxied. */
const VERBOTEN_METHODS = new Set([
  // Standard constructor method name.
  'constructor',

  // Promise interface. If proxied, this confuses the promise system, as it
  // just looks for these methods to figure out if it's working with a
  // "promise."
  'then',
  'catch'
]);

/**
 * Base class for a proxy handler for the common pattern of keeping a cache of
 * computed property values, along with a subclass hole to be filled in for how
 * to compute those values in the first place. A typical use of this is to
 * provide a proxy which appears as an instance with infinitely many methods,
 * though there are many other uses as well.
 *
 * As special cases:
 *
 * * This class refuses to proxy properties named `constructor`, `then`, or
 *   `catch`. The former if proxied can confuse the system into thinking what's
 *   being proxied is a class. The latter two can confuse the system into
 *   thinking that what's being proxied is a promise. (Duck typing FTL!) Though
 *   in the larger sense it is okay to proxy these things, the usual case -- and
 *   the one supported by this class -- is that what's proxied is just a
 *   plain-old-instance filled with normal properties and methods.
 *
 * * This class returns a simple but useful (and non-confusing) implementation
 *   when asked for the standard "custom inspection" function
 *   `util.inspect.custom`. This is done instead of letting the subclass return
 *   what would no doubt turn out to be a confusing implementation.
 *
 * Use this class by making a subclass, filling in the `_impl`, and constructing
 * a `Proxy` via the static method {@link #makeProxy}.
 */
export class MethodCacheProxyHandler extends BaseProxyHandler {
  /**
   * @type {Map<string, *>} Cached property values, as a map from name to
   * handler.
   */
  #properties = new Map();

  // Note: The default constructor suffices here.

  /**
   * Standard `Proxy` handler method. This defers to {@link #_impl_valueFor} to
   * generate property values that aren't yet cached.
   *
   * @param {object} target_unused The proxy target.
   * @param {string|symbol} property The property name.
   * @param {object} receiver_unused The original receiver of the request.
   * @returns {*} The property, or `undefined` if there is no such property
   *   defined.
   */
  get(target_unused, property, receiver_unused) {
    const method = this.#properties.get(property);

    if (method) {
      return method;
    } else if (VERBOTEN_METHODS.has(property)) {
      // This property is on the blacklist of ones to never proxy.
      return undefined;
    } else if (property === util.inspect.custom) {
      // Very special case: We're being asked for the standard "custom
      // inspector" method name. Return a straightforward implementation. This
      // makes it possible to call `util.inspect` on a proxy made from an
      // instance of this class and get a reasonably useful result (instead of
      // calling through to the `_impl` and doing something totally
      // inscrutable), which is a case that _has_ arisen in practice (while
      // debugging).
      return () => '[object Proxy]';
    } else {
      // The property is allowed to be proxied. Figure out the value, and cache
      // it (unless asked not to).
      const result = this._impl_valueFor(property);
      if (result instanceof MethodCacheProxyHandler.NoCache) {
        return result.value;
      } else {
        this.#properties.set(property, result);
        return result;
      }
    }
  }

  /**
   * Returns the property value for the given name. The property value will
   * ultimately get accessed by client code as a property on a proxy instance,
   * including (typically) being called as a method on that proxy. If this
   * method returns an instance of {@link #NoCache} instead of some other value,
   * the result is _not_ cached for future returns.
   *
   * @abstract
   * @param {string|symbol} name The property name.
   * @returns {*|NoCache} The property value for `name`.
   */
  _impl_valueFor(name) {
    return Methods.abstract(name);
  }


  //
  // Static members
  //

  /**
   * Class which can be used to wrap results from {@link #_impl_valueFor}, to
   * indicate that they shouldn't be cached.
   */
  static NoCache = class NoCache {
    /** @type {*} The property value to not-cache. */
    #value;

    /**
     * Constructs an instance.
     *
     * @param {*} value The property value to not-cache.
     */
    constructor(value) {
      this.#value = value;
    }

    /** @returns {*} The property value to not-cache. */
    get value() {
      return this.#value;
    }
  };

  /**
   * Recommended -- and convenient -- way to construct an instance of {@link
   * #NoCache}.
   *
   * @param {*} value The property value to not-cache.
   * @returns {NoCache} Cache-preventing instance.
   */
  static noCache(value) {
    return new this.NoCache(value);
  }
}
