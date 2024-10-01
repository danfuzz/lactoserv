// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { types } from 'node:util';

import { AskIf } from '@this/typey';

/**
 * Abstract base class which implements the classic "visitor" pattern for
 * iterating over JavaScript values and their components, using depth-first
 * traversal.
 *
 * @abstract
 */
export class BaseValueVisitor {
  /**
   * Map from visited values to their visit-in-progress-or-completed entries.
   *
   * @type {Map<*, BaseValueVisitor#VisitEntry>}
   */
  #visits = new Map();

  /**
   * The root value being visited.
   *
   * @type {*}
   */
  #value;

  /**
   * Constructs an instance whose purpose in life is to visit the indicated
   * value.
   *
   * @param {*} value The value to visit.
   */
  constructor(value) {
    this.#value = value;
  }

  /**
   * @returns {*} The root value being visited by this instance, that is, the
   * `value` passed in to the constructor of this instance.
   */
  get value() {
    return this.#value;
  }

  /**
   * Visits this instance's designated value. This in turn calls through to the
   * various `_impl_*()` methods, as appropriate. The return value is whatever
   * was returned from the `_impl_*()` method that was called to do the main
   * processing of the value, except that this method "collapses" the promises
   * that result from asynchronous visitor behavior with the promises that are
   * direct visitor results. See {@link #visitWrap} for a "promise-preserving"
   * variant.
   *
   * If this method is called more than once on any given instance, the visit
   * procedure is only actually run once; subsequent calls reuse the return
   * value from the first call, even if the first call is still in progress at
   * the time of the call.
   *
   * @returns {*} Whatever result was returned from the `_impl_*()` method which
   * processed the original `value`.
   */
  async visit() {
    const visitEntry = this.#visitNode(this.#value);

    if (visitEntry.ok === null) {
      // Wait for the visit to complete, either successfully or not. This should
      // never throw.
      await visitEntry.promise;
    }

    // Note: If `visitEntry.result` is a promise, this will cause the caller to
    // ultimately receive the resolved/rejected value of it. See the header
    // comment for details.
    return visitEntry.extract();
  }

  /**
   * Similar to {@link #visit}, except (a) it will fail if the visit could not
   * complete synchronously, and (b) a returned promise is only ever due to a
   * visitor returning a promise per se (and not from it acting asynchronously).
   *
   * @returns {*} Whatever result was returned from the `_impl_*()` method which
   * processed the original `value`.
   */
  visitSync() {
    const visitEntry = this.#visitNode(this.#value);

    switch (visitEntry.ok) {
      case null: {
        throw new Error('Could not complete synchronously.');
      }
      case false: {
        throw visitEntry.error;
      }
      case true: {
        return visitEntry.result;
      }
      /* c8 ignore start */
      default: {
        // This is indicative of a bug in this class.
        throw new Error('Shouldn\'t happen.');
      }
      /* c8 ignore stop */
    }
  }

  /**
   * Like {@link #visit}, except that successful results are wrapped in an
   * instance of {@link BaseValueVisitor#WrappedResult}, which makes it possible
   * for a caller to tell the difference between a promise which is returned
   * because the visitor is acting asynchronously and a promise which is
   * returned because that's an actual visitor result.
   *
   * @returns {*} Whatever result was returned from the `_impl_*()` method which
   * processed the original `value`.
   */
  async visitWrap() {
    const visitEntry = this.#visitNode(this.#value);

    if (visitEntry.ok === null) {
      // Wait for the visit to complete, either successfully or not. This should
      // never throw.
      await visitEntry.promise;
    }

    if (visitEntry.ok) {
      return new BaseValueVisitor.WrappedResult(visitEntry.result);
    } else {
      throw visitEntry.error;
    }
  }

  /**
   * Visitor for a "node" (referenced value, including possibly the root) of the
   * graph of values being visited. If there is already an entry in
   * {@link #visits} for the node, it is returned. Otherwise, a new entry is
   * created, and visiting is initiated (and possibly, but not necessarily,
   * finished).
   *
   * @param {*} node The node being visited.
   * @returns {BaseValueVisitor#VisitEntry} Entry from {@link #visits} which
   *   represents the current state of the visit.
   */
  #visitNode(node) {
    const already = this.#visits.get(node);

    if (already) {
      return already;
    }

    const visitEntry = new BaseValueVisitor.#VisitEntry(node);
    this.#visits.set(node, visitEntry);

    visitEntry.promise = (async () => {
      // This is called without `await` exactly so that, in the case of a fully
      // synchronous visitor, the ultimate result will be able to be made
      // available synchronously.
      const done = this.#visitNode0(visitEntry);

      if (visitEntry.ok === null) {
        // This is not ever supposed to throw. (See implementation of
        // `visitNode0()`, below.)
        await done;
      }

      return visitEntry;
    })();

    return visitEntry;
  }

  /**
   * Helper for {@link #visitNode}, which does the main dispatch work, and
   * stores the result or error into the entry.
   *
   * @param {BaseValueVisitor#VisitorEntry} visitEntry The entry for the node
   *   being visited.
   * @returns {null} Async-returned when visiting is completed, whether or not
   *   successful.
   */
  async #visitNode0(visitEntry) {
    try {
      let result = this.#visitNode1(visitEntry.node);

      if (result instanceof Promise) {
        result = await result;
      }

      visitEntry.ok     = true;
      visitEntry.result = (result instanceof BaseValueVisitor.WrappedResult)
        ? result.value
        : result;
    } catch (e) {
      visitEntry.ok    = false;
      visitEntry.error = e;
    }
  }

  /**
   * Helper for {@link #visitNode}, which does the actual dispatch.
   *
   * @param {*} node The node being visited.
   * @returns {*} Whatever the `_impl_visit*()` method returned.
   */
  #visitNode1(node) {
    switch (typeof node) {
      case 'bigint': {
        return this._impl_visitBigInt(node);
      }

      case 'boolean': {
        return this._impl_visitBoolean(node);
      }

      case 'number': {
        return this._impl_visitNumber(node);
      }

      case 'string': {
        return this._impl_visitString(node);
      }

      case 'symbol': {
        return this._impl_visitSymbol(node);
      }

      case 'undefined': {
        return this._impl_visitUndefined();
      }

      case 'function': {
        if (types.isProxy(node)) {
          return this._impl_visitProxy(node, true);
        } else if (AskIf.callableFunction(node)) {
          return this._impl_visitFunction(node);
        } else {
          return this._impl_visitClass(node);
        }
      }

      case 'object': {
        if (node === null) {
          return this._impl_visitNull();
        } else if (types.isProxy(node)) {
          return this._impl_visitProxy(node, false);
        } else if (Array.isArray(node)) {
          return this._impl_visitArray(node);
        } else if (AskIf.plainObject(node)) {
          return this._impl_visitPlainObject(node);
        } else {
          return this._impl_visitInstance(node);
        }
      }

      /* c8 ignore start */
      default: {
        // JavaScript added a new type after this code was written!
        throw new Error(`Unrecognized \`typeof\` result: ${typeof node}`);
      }
      /* c8 ignore stop */
    }
  }

  /**
   * Visits an array. The base implementation returns the given `node` as-is.
   * Subclasses that wish to traverse the contents can do so by calling
   * {@link #_prot_visitArrayProperties}.
   *
   * @param {Array} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitArray(node) {
    return this._prot_wrapResult(node);
  }

  /**
   * Visits a `bigint` value. The base implementation returns the given `node`
   * as-is.
   *
   * @param {bigint} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitBigInt(node) {
    return node;
  }

  /**
   * Visits a `boolean` value. The base implementation returns the given `node`
   * as-is.
   *
   * @param {boolean} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitBoolean(node) {
    return node;
  }

  /**
   * Visits a "class," that is, a constructor function which is only usable via
   * `new` expressions. The base implementation returns the given `node` as-is.
   *
   * @param {function(new:*)} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitClass(node) {
    return this._prot_wrapResult(node);
  }

  /**
   * Visits a _callable_ function, that is, a function which is known to not
   * _only_ be usable as a constructor (even if it is typically supposed to be
   * used as such). The base implementation returns the given `node` as-is.
   *
   * @param {function()} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitFunction(node) {
    return this._prot_wrapResult(node);
  }

  /**
   * Visits an instance, that is, a non-`null` value of type `object` which has
   * a `prototype` that indicates that it is an instance of _something_ other
   * than `Object`. The base implementation returns the given `node` as-is.
   *
   * @param {object} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitInstance(node) {
    return this._prot_wrapResult(node);
  }

  /**
   * Visits the literal value `null`. The base implementation returns `null`.
   *
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitNull() {
    return null;
  }

  /**
   * Visits a `number` value. The base implementation returns the given `node`
   * as-is.
   *
   * @param {number} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitNumber(node) {
    return node;
  }

  /**
   * Visits a plain object value, that is, a non-`null` value of type `object`,
   * which has a `prototype` of either `null` or the class `Object`. The base
   * implementation returns the given `node` as-is. Subclasses that wish to
   * traverse the contents can do so by calling {@link
   * #_prot_visitObjectProperties}.
   *
   * @param {object} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitPlainObject(node) {
    return this._prot_wrapResult(node);
  }

  /**
   * Visits a proxy value, that is, a value which uses the JavaScript `Proxy`
   * mechanism for its implementation. The base implementation returns the given
   * `node` as-is.
   *
   * @param {*} node The node to visit.
   * @param {boolean} isFunction The result of `typeof node === 'function'`.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitProxy(node, isFunction) { // eslint-disable-line no-unused-vars
    return this._prot_wrapResult(node);
  }

  /**
   * Visits a `string` value. The base implementation returns the given `node`
   * as-is.
   *
   * @param {string} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitString(node) {
    return node;
  }

  /**
   * Visits a `symbol` value. The base implementation returns the given `node`
   * as-is.
   *
   * @param {number} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitSymbol(node) {
    return node;
  }

  /**
   * Visits the literal value `undefined`. The base implementation returns
   * `undefined`.
   *
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitUndefined() {
    return undefined;
  }

  /**
   * Visits the indexed values and any other properties of an array, _excluding_
   * `length`. Returns an array consisting of all the visited values, with
   * indices / property names corresponding to the original. If the original
   * `node` is a sparse array, the result will have the same "holes."
   *
   * @param {Array} node The node whose contents are to be visited.
   * @returns {Array|Promise} An array of visited results, or a promise for same
   *   in the case where any of the visitor methods act asynchronously.
   */
  _prot_visitArrayProperties(node) {
    return this.#visitProperties(node, Array(node.length));
  }

  /**
   * Visits the property valies of an object (typically a plain object).
   * Returns a new plain object consisting of all the visited values, with
   * property names corresponding to the original.
   *
   * @param {object} node The node whose contents are to be visited.
   * @returns {object|Promise} A `null`-prototype object with the visited
   *   results, or a promise for same in the case where any of the visitor
   *   methods act asynchronously.
   */
  _prot_visitObjectProperties(node) {
    return this.#visitProperties(node, Object.create(null));
  }

  /**
   * Wraps a visitor result, so as to make it unambiguous that it is indeed a
   * result. This is primarily useful for concrete visitors that have reason to
   * return `Promise` instances as the result of visiting per se, as opposed to
   * returning them because the visitor is itself asynchronous.
   *
   * @param {*} result The result of visiting, per se.
   * @returns {*} Unambiguous visitor result.
   */
  _prot_wrapResult(result) {
    const type = typeof result;

    if ((type === 'object') || (type === 'function')) {
      // Intentionally conservative check.
      if ((typeof result.then) === 'function') {
        return new BaseValueVisitor.WrappedResult(result);
      }
    }

    return result;
  }

  /**
   * Helper for {@link #_prot_visitArrayProperties} and
   * {@link #_prot_visitObjectProperties}, which does most of the work.
   *
   * @param {object} node The node whose contents are to be visited.
   * @param {object} result The result object or array to be filled in.
   * @returns {object|Promise} `result` if the visitor acted entirely
   *   synchronously, or a promise for `result` if not.
   */
  #visitProperties(node, result) {
    const isArray   = Array.isArray(result);
    const promNames = [];

    for (const name of Object.getOwnPropertyNames(node)) {
      if (!(isArray && (name === 'length'))) {
        const got = this.#visitNode(node[name]);
        if (got.ok === null) {
          promNames.push(name);
          result[name] = got.promise;
        } else if (got.ok) {
          result[name] = got.result;
        } else {
          throw got.error;
        }
      }
    }

    for (const name of Object.getOwnPropertySymbols(node)) {
      const got = this.#visitNode(node[name]);
      if (got.ok === null) {
        promNames.push(name);
        result[name] = got.promise;
      } else if (got.ok) {
        result[name] = got.result;
      } else {
        throw got.error;
      }
    }

    if (promNames.length === 0) {
      return result;
    } else {
      // There was at least one promise returned from visiting an element.
      return (async () => {
        for (const name of promNames) {
          result[name] = (await result[name]).extract();
        }

        return result;
      })();
    }
  }


  //
  // Static members
  //

  /**
   * Entry in a {@link #visits} map.
   */
  static #VisitEntry = class VisitEntry {
    /**
     * The value whose visit this entry represents.
     *
     * @type {*}
     */
    node;

    /**
     * Success-or-error flag, or `null` if the visit is still in progress.
     *
     * @type {?boolean}
     */
    ok = null;

    /**
     * Promise for this instance, which resolves only after the visit completes.
     * or `null` if this instance's corresponding visit hasn't yet been started.
     *
     * @type {Promise<BaseValueVisitor#VisitEntry>}
     */
    promise = null;

    /**
     * Error thrown by the visit, or `null` if no error has yet been thrown.
     *
     * @type {Error}
     */
    error = null;

    /**
     * Successful result of the visit, or `null` if the visit is either still in
     * progress or ended with a failure.
     *
     * @type {*}
     */
    result = null;

    /**
     * Constructs an instance.
     *
     * @param {*} node The node whose visit is being represented.
     */
    constructor(node) {
      this.node = node;
    }

    /**
     * Extracts the result or error of a visit.
     *
     * @returns {*} The successful result of the visit, if it was indeed
     *   successful.
     * @throws {Error} The error resulting from the visit, if it failed; or
     *   an error indicating that the visit is still in progress.
     */
    extract() {
      /* c8 ignore start */
      if (this.ok === null) {
        // The code that calls this should only end up doing so when the
        // instance's visit is known to be finished.
        if (this.promise === null) {
          throw new Error('Shouldn\'t happen: Visit not yet started.');
        } else {
          throw new Error('Shouldn\'t happen: Visit not yet complete.');
        }
      }
      /* c8 ignore end */

      if (this.ok) {
        return this.result;
      } else {
        throw this.error;
      }
    }
  };

  /**
   * Wrapper for visitor results, used to disambiguate `Promises` used as part
   * of the visitor mechanism from `Promises` used as the actual results of
   * visiting something.
   */
  static WrappedResult = class WrappedResult {
    /**
     * The wrapped value.
     *
     * @type {*}
     */
    #value;

    /**
     * Constructs an instance.
     *
     * @param {*} value The value to wrap.
     */
    constructor(value) {
      this.#value = value;
    }

    /** @returns {*} The wrapped value. */
    get value() {
      return this.#value;
    }
  };
}
