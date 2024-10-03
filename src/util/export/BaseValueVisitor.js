// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { types } from 'node:util';

import { AskIf, MustBe } from '@this/typey';

import { VisitRef } from '#x/VisitRef';
import { VisitResult } from '#x/VisitResult';


/**
 * Base class which implements the classic "visitor" pattern for iterating over
 * JavaScript values and their components, using depth-first traversal.
 *
 * Note that, though this class isn't abstract, it isn't particularly useful
 * without being (effectively) subclassed. In particular, there are a set of
 * methods on this class named `_impl_visit*()`, for each possible category of
 * value. The default implementation of each of these is a pass-through. A
 * useful subclass will override one or more of these to do something else. And
 * in service of implementing subclasses, there are a handful of `_prot_*()`
 * methods, which implement standard common visiting behaviors.
 *
 * Of particular note, JavaScript makes it easy to induce a "layering ambiguity"
 * when working with promises, in that `async` methods naturally return
 * promises, and yet promises are also just objects. This class makes it
 * possible to maintain the distinction about what layer a promise is coming
 * from -- asynchrounous visitor or simply a visitor returning a promise -- but
 * it requires explicit coding on the part of the visitor. Specifically, if a
 * visitor implementation wants to return a promise as the result of a visit, it
 * must use the method `_prot_wrapResult()` on its return value. Such a wrapped
 * value will get treated literally through all the visitor plumbing. Then, in
 * order to receive a promise from a visit call, client code can either use
 * {@link #visitSync} or {@link #visitWrap} (but not normal asynchronous
 * {@link #visit}).
 */
export class BaseValueVisitor {
  /**
   * Is this instance proxy-aware?
   *
   * @type {boolean}
   */
  #proxyAware;

  /**
   * The root value being visited.
   *
   * @type {*}
   */
  #rootValue;

  /**
   * Map from visited values to their visit representatives.
   *
   * @type {Map<*, BaseValueVisitor#VisitEntry>}
   */
  #visits = new Map();

  /**
   * During a visit, the array of all refs created during the visit, in order;
   * after the first post-visit call to {@link #refFromResultValue}, a map from
   * result values to corresponding refs.
   *
   * @type {Array<VisitRef>|Map<*, VisitRef>}
   */
  #allRefs = [];

  /**
   * The set of visit entries that are currently part of an `await` chain. This
   * is used to detect attempts to visit a value with a circular reference,
   * where the circular nature only becomes apparent asynchronously.
   *
   * @type {Set<BaseValueVisitor#VisitEntry>}
   */
  #waitSet = new Set();

  /**
   * Constructs an instance whose purpose in life is to visit the indicated
   * value.
   *
   * @param {*} value The value to visit.
   */
  constructor(value) {
    this.#proxyAware = MustBe.boolean(this._impl_isProxyAware());
    this.#rootValue  = value;
  }

  /**
   * @returns {*} The root value being visited by this instance, that is, the
   * `value` passed in to the constructor of this instance.
   */
  get rootValue() {
    return this.#rootValue;
  }

  /**
   * Gets the ref corresponding to a particular visit result value (either the
   * root visit result or the result of a sub-visit), if such a ref was created
   * during the visit. This method only produces valid results after a visit has
   * finished.
   *
   * @param {*} value The result value to look up.
   * @returns {?VisitRef} The corresponding ref, or `null` if there is no ref
   *   for `value`.
   */
  refFromResultValue(value) {
    if (Array.isArray(this.#allRefs)) {
      // Either the visit is still in progress, or this is the first post-visit
      // call to this method.
      const entry = this.#visitRoot();
      if (!entry.isFinished()) {
        // The visit is still in progress.
        return null;
      }

      const refMap = new Map();
      for (const ref of this.#allRefs) {
        refMap.set(ref.value, ref);
      }

      this.#allRefs = refMap;
    }

    return this.#allRefs.get(value) ?? null;
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
    return this.#visitRoot().extractAsync(false);
  }

  /**
   * Similar to {@link #visit}, except (a) it will fail if the visit could not
   * become finished synchronously, and (b) a returned promise is only ever due
   * to a visitor returning a promise per se (and not from it acting
   * asynchronously).
   *
   * @returns {*} Whatever result was returned from the `_impl_*()` method which
   * processed the original `value`.
   */
  visitSync() {
    return this.#visitRoot().extractSync(true);
  }

  /**
   * Like {@link #visit}, except that successful results are wrapped in an
   * instance of {@link VisitResult}, which makes it possible for a caller to
   * tell the difference between a promise which is returned because the visitor
   * is acting asynchronously and a promise which is returned because that's an
   * actual visitor result.
   *
   * @returns {*} Whatever result was returned from the `_impl_*()` method which
   * processed the original `value`.
   */
  async visitWrap() {
    return this.#visitRoot().extractAsync(true);
  }

  /**
   * Indicates whether this instance should be aware of proxies. If `true`,
   * visiting a proxy will cause {@link #_impl_visitProxy} to be called. If
   * `false`, visiting a proxy will cause an `_impl_visit*()` method to be
   * called based on the type of value that the proxy is proxying.
   *
   * This method is called once during construction of this instance. The base
   * implementation always returns `false`, that is, by default instances are
   * unaware of proxies.
   *
   * @returns {boolean} The proxy-awareness indicator.
   */
  _impl_isProxyAware() {
    return false;
  }

  /**
   * Indicates whether the given value, which has already been determined to be
   * referenced more than once in the graph of values being visited, should be
   * converted into a ref object for all but the first visit. The various
   * `visit*()` methods will call this any time they encounter a value (of any
   * type) which has been visited before (or is currently being visited),
   * _except_ a ref instance (instance of {@link VisitRef}) will never be
   * subject to potential "re-reffing."
   *
   * Note that, for values that are visited recursively and have at least one
   * self-reference (that is, a circular reference), returning `false` will
   * cause the visit to _not_ be able to finish, in that the construction of a
   * visit result will require itself to be known before its own construction.
   *
   * The base implementation always returns `false`. A common choice for a
   * subclass is to return `true` for objects and functions and `false` for
   * everything else.
   *
   * @param {*} value The value to check.
   * @returns {boolean} `true` if `value` should be converted into a reference.
   *   or `false` if not.
   */
  _impl_shouldRef(value) { // eslint-disable-line no-unused-vars
    return false;
  }

  /**
   * Visits an array, that is, an object for which `Array.isArray()` returns
   * `true`. The base implementation returns the given `node` as-is. Subclasses
   * that wish to visit the contents can do so by calling
   * {@link #_prot_visitArrayProperties}.
   *
   * @param {Array} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitArray(node) {
    return this._prot_wrapResult(node);
  }

  /**
   * Visits a value of type `bigint`. The base implementation returns the given
   * `node` as-is.
   *
   * @param {bigint} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitBigInt(node) {
    return node;
  }

  /**
   * Visits a value of type `boolean`. The base implementation returns the given
   * `node` as-is.
   *
   * @param {boolean} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitBoolean(node) {
    return node;
  }

  /**
   * Visits a class, that is, a value of type `function` which is only usable
   * via `new` expressions by virtue of the fact that it was (effectively)
   * defined using a `class` statement or expression. The base implementation
   * returns the given `node` as-is.
   *
   * @param {function(new:*)} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitClass(node) {
    return this._prot_wrapResult(node);
  }

  /**
   * Visits a _callable_ function, that is, a value of type `function` which is
   * not known _only_ to be usable as a constructor (even if it is typically
   * supposed to be used as such). The base implementation returns the given
   * `node` as-is.
   *
   * **Note:** Because of JavaScript history, this method will get called on
   * constructor functions which are _not_ defined using `class` but which
   * nonetheless throw an error when used without `new`, such as, notably, many
   * of the built-in JavaScript classes (such as `Map`).
   *
   * @param {function()} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitFunction(node) {
    return this._prot_wrapResult(node);
  }

  /**
   * Visits an instance, that is, a non-`null` value of type `object` which has
   * a prototype that indicates that it is an instance of _something_ other than
   * `Object`. The base implementation returns the given `node` as-is.
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
   * Visits a value of type `number`. The base implementation returns the given
   * `node` as-is.
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
   * visit the contents can do so by calling
   * {@link #_prot_visitObjectProperties}.
   *
   * @param {object} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitPlainObject(node) {
    return this._prot_wrapResult(node);
  }

  /**
   * Visits a proxy value, that is, a value which uses the JavaScript `Proxy`
   * mechanism for its implementation and as such which
   * `node:util.types.isProxy()` indicates is a proxy. The base implementation
   * returns the given `node` as-is.
   *
   * @param {*} node The node to visit.
   * @param {boolean} isFunction The result of `typeof node === 'function'`.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitProxy(node, isFunction) { // eslint-disable-line no-unused-vars
    return this._prot_wrapResult(node);
  }

  /**
   * Visits a reference to a visit result from the visit currently in progress.
   * When {@link #_impl_shouldRef} indicates that an already-seen value should
   * become a "ref," then this is the method that ultimately gets called in
   * order to visit that ref. The base implementation returns the given node
   * as-is.
   *
   * @param {VisitRef} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitRef(node) {
    return node;
  }

  /**
   * Visits a value of type `string`. The base implementation returns the given
   * `node` as-is.
   *
   * @param {string} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitString(node) {
    return node;
  }

  /**
   * Visits a value of type `symbol`. The base implementation returns the given
   * `node` as-is.
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
   * Visits the indexed values and any other "own" property values of an array,
   * _excluding_ `length`. Returns an array consisting of all the visited
   * values, with indices / property names corresponding to the original. If the
   * original `node` is a sparse array, the result will have the same "holes."
   *
   * **Note:** If the given `node` has synthetic properties, this method will
   * call those properties' getters.
   *
   * @param {Array} node The node whose contents are to be visited.
   * @returns {Array|Promise} An array of visited results, or a promise for same
   *   in the case where any of the visitor methods act asynchronously.
   */
  _prot_visitArrayProperties(node) {
    return this.#visitProperties(node, Array(node.length));
  }

  /**
   * Visits the "own" property values of an object (typically a plain object).
   * Returns a new plain object consisting of all the visited values, with
   * property names corresponding to the original.
   *
   * **Note:** If the given `node` has synthetic properties, this method will
   * call those properties' getters.
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
   * return `Promise` (or promise-like) instances as the result of visiting per
   * se, as opposed to returning them because the visitor is itself
   * asynchronous.
   *
   * **Note:** It is safe to call this method indiscriminately on all visitor
   * results. The method will only bother wrapping things that could be mistaken
   * for promises.
   *
   * @param {*} result A direct result of visiting, per se.
   * @returns {*} Unambiguous visitor result.
   */
  _prot_wrapResult(result) {
    const type = typeof result;

    if ((type === 'object') || (type === 'function')) {
      // Intentionally conservative check.
      if (result && ((typeof result.then) === 'function')) {
        return new VisitResult(result);
      }
    }

    return result;
  }

  /**
   * Is the given value a proxy which should be detected as such? This checks
   * proxyness, but only if the instance is configured to do so.
   *
   * @param {*} value Value to check.
   * @returns {boolean} `true` iff it is detected as a proxy.
   */
  #isProxy(value) {
    return this.#proxyAware && types.isProxy(value);
  }

  /**
   * Assuming this is its second-or-later (recursive or sibling) visit, should
   * the given value be turned into a ref? This just defers to
   * {@link #_impl_shouldRef}, except that refs themselves are never considered
   * for re-(re-...)reffing.
   *
   * @param {*} value Value to check.
   * @returns {boolean} `true` iff `value` should be turned into a ref.
   */
  #shouldRef(value) {
    return !(value instanceof VisitRef)
      && this._impl_shouldRef(value);
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
      const ref = already.ref;
      if (ref) {
        return this.#visitNode(ref);
      } else if (this.#shouldRef(node)) {
        const newRef = already.setRef(this.#allRefs.length);
        this.#allRefs.push(newRef);
        return this.#visitNode(newRef);
      } else {
        return already;
      }
    }

    const visitEntry = new BaseValueVisitor.#VisitEntry(node);
    this.#visits.set(node, visitEntry);

    // This call synchronously calls back to `visitNode0()`.
    visitEntry.startVisit(this);

    return visitEntry;
  }

  /**
   * Helper for {@link #visitNode}, which does the actual dispatch.
   *
   * @param {*} node The node being visited.
   * @returns {*} Whatever the `_impl_visit*()` method returned.
   */
  #visitNode0(node) {
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
        if (this.#isProxy(node)) {
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
        } else if (this.#isProxy(node)) {
          return this._impl_visitProxy(node, false);
        } else if (Array.isArray(node)) {
          return this._impl_visitArray(node);
        } else if (AskIf.plainObject(node)) {
          return this._impl_visitPlainObject(node);
        } else if (node instanceof VisitRef) {
          return this._impl_visitRef(node);
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
   * Helper for {@link #_prot_visitArrayProperties} and
   * {@link #_prot_visitObjectProperties}, which does most of the work.
   *
   * @param {object} node The node whose contents are to be visited.
   * @param {object} result The result object or array to be filled in.
   * @returns {object|Promise} `result` if the visitor acted entirely
   *   synchronously, or a promise for `result` if not.
   */
  #visitProperties(node, result) {
    const isArray  = Array.isArray(result);
    const promInfo = [];

    const addResults = (iter) => {
      for (const name of iter) {
        if (!(isArray && (name === 'length'))) {
          const entry = this.#visitNode(node[name]);
          // Note: `isFinished()` detects synchronous reference cycles.
          if (entry.isFinished()) {
            result[name] = entry.extractSync();
          } else {
            promInfo.push({ name, entry });
            result[name] = null; // For consistent result property order.
          }
        }
      }
    };

    addResults(Object.getOwnPropertyNames(node));
    addResults(Object.getOwnPropertySymbols(node));

    if (promInfo.length === 0) {
      return result;
    } else {
      // At least one property's visit didn't finish synchronously.
      return (async () => {
        for (const { name, entry } of promInfo) {
          if (this.#waitSet.has(entry)) {
            throw new Error('Visit is deadlocked due to circular reference.');
          }

          try {
            this.#waitSet.add(entry);
            await entry.promise;
          } finally {
            this.#waitSet.delete(entry);
          }

          result[name] = entry.extractSync();
        }

        return result;
      })();
    }
  }

  /**
   * Gets the entry for the root value being visited, including starting the
   * visit (and possibly completing it) if this is the first time a `visit*()`
   * method is being called.
   *
   * @returns {BaseValueVisitor#VisitEntry} Vititor entry for the root value.
   */
  #visitRoot() {
    const node = this.#rootValue;
    return this.#visits.get(node) ?? this.#visitNode(node);
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
    #node;

    /**
     * Success-or-error flag, or `null` if the visit is still in progress.
     *
     * @type {?boolean}
     */
    #ok = null;

    /**
     * Promise for this instance, which resolves only after the visit finishes;
     * or `null` if this instance's corresponding visit hasn't yet been started
     * enough to have a promise.
     *
     * @type {Promise<BaseValueVisitor#VisitEntry>}
     */
    #promise = null;

    /**
     * Error thrown by the visit, or `null` if no error has yet been thrown.
     *
     * @type {Error}
     */
    #error = null;

    /**
     * Successful result value of the visit, or `null` if the visit is either
     * still in progress or ended with a failure.
     *
     * @type {*}
     */
    #value = null;

    /**
     * Ref which corresponds to this instance, or `null` if there is none.
     *
     * @type {?VisitRef}
     */
    #ref = null;

    /**
     * Constructs an instance.
     *
     * @param {*} node The value whose visit is being represented.
     */
    constructor(node) {
      this.#node = node;
    }

    /**
     * @returns {*} The original value (not the visit result) which this
     * instance is a reference to.
     */
    get originalValue() {
      return this.#node;
    }

    /**
     * @returns {Promise} A promise for `this`, which resolves once the visit
     * has been finished (whether or not successful). It is only valid to use
     * this getter after {@link #startVisit} has been called, and in the case
     * where this gets called _after_ a call to {@link #startVisit} but _before_
     * it synchronously returns, this will throw an error indicating that the
     * visit contains a (synchronously detected) circular reference.
     */
    get promise() {
      if (this.#promise) {
        return this.#promise;
      }

      // This is the case when a visited value has a synchronously-discovered
      // circular reference, that is, when the synchronous portion of visiting
      // the value causes a (non-ref) request to visit itself. More or less by
      // definition, there is no possible way to handle this. To visit values
      // with circular references, all circles must be broken by replacing them
      // with refs.
      throw new Error('Visit is deadlocked due to circular reference.');
    }

    /**
     * @returns {?VisitRef} Ref which corresponds to this instance, or `null` if
     * there is none.
     */
    get ref() {
      return this.#ref;
    }

    /**
     * Extracts the result or error of a visit, always first waiting until after
     * the visit is finished.
     *
     * Note: If this visit finished successfully with a promise value, and
     * `wrapResult` is passed as `false`, this will cause the client (external
     * caller) to ultimately receive the fulfilled (resolved/rejected) value of
     * that promise and not the result promise per se. This is the crux of the
     * difference between {link #visit} and {@link #visitWrap} (see which).
     *
     * @param {boolean} wrapResult Should a successful result be wrapped?
     * @returns {*} The successful result of the visit, if it was indeed
     *   successful.
     * @throws {Error} The error resulting from the visit, if it failed.
     */
    async extractAsync(wrapResult) {
      if (!this.isFinished()) {
        // Wait for the visit to finish, either successfully or not. This should
        // never throw.
        await this.#promise;
      }

      if (this.#ok) {
        return wrapResult
          ? new VisitResult(this.#value)
          : this.#value;
      } else {
        throw this.#error;
      }
    }

    /**
     * Synchronously extracts the result or error of a visit.
     *
     * @param {boolean} [possiblyUnfinished] Should it be an _expected_
     *   possibility that the visit has been started but not finished?
     * @returns {*} The successful result of the visit, if it was indeed
     *   successful.
     * @throws {Error} The error resulting from the visit, if it failed; or
     *   an error indicating that the visit is still in progress.
     */
    extractSync(possiblyUnfinished = false) {
      if (this.isFinished()) {
        if (this.#ok) {
          return this.#value;
        } else {
          throw this.#error;
        }
      } else if (possiblyUnfinished) {
        throw new Error('Visit did not finish synchronously.');
        /* c8 ignore start */
      } else {
        // This is indicative of a bug in this class: If the caller thinks it's
        // possible that the visit hasn't finished, it should have passed `true`
        // to this method.
        throw new Error('Shouldn\'t happen: Visit not yet finished.');
        /* c8 ignore end */
      }
    }

    /**
     * Returns an indication of whether the visit has finished, also detecting
     * the case of a synchronously-detected reference cycle.
     *
     * @returns {boolean} `false` if the visit is in progress, or `true` if it
     *   is finished.
     * @throws {Error} Thrown if this method is called before a call to
     *   {@link #startVisit} on this instance returns (including being called
     *   before any call to {@link #startVisit}), which indicates that the
     *   value being visited is involved in a circular reference.
     */
    isFinished() {
      if (this.#ok === null) {
        // Force a "circular reference" error if this method is called in the
        // middle of a call to `this.startVisit()`.
        this.promise;
      } else {
        return true;
      }
    }

    /**
     * Creates and stores a ref which is to correspond to this instance,
     * assigning it the indicated index. It is only valid to ever call this
     * method once on any given instance.
     *
     * @param {number} index The index for the ref.
     * @returns {VisitRef} The newly-constructed ref.
     */
    setRef(index) {
      if (this.#ref) {
        throw new Error('Ref already set.');
      }

      this.#ref = new VisitRef(this, index);
      return this.#ref;
    }

    /**
     * Starts the visit for this instance. If the visit could be synchronously
     * finished, the instance state will reflect that fact upon return. If not,
     * the visit will continue asynchronously, after this method returns.
     *
     * @param {BaseValueVisitor} outerThis The outer instance associated with
     *   this instance.
     */
    startVisit(outerThis) {
      // Note: See the implementation of `.promise` for an important detail
      // about circular references.
      this.#promise = (async () => {
        try {
          let result = outerThis.#visitNode0(this.#node);

          if (result instanceof Promise) {
            // This is the moment that this visit becomes "not synchronously
            // finished." If we don't end up here, then, even though this
            // (anonymous IIFE) function is `async`, by the time the call
            // synchronously completes, the visit will have finished. (This is
            // because an `async` function runs synchronously with respect to
            // the caller up to the first `await`.)
            result = await result;
          }

          this.#finishWithValue(result);
        } catch (e) {
          this.#finishWithError(e);
        }

        return this;
      })();
    }

    /**
     * Sets the visit result to be a non-error value. This indicates that the
     * visit has in fact finished with `ok === true`. If given a
     * {@link VisitResult}, this unwraps it before storing.
     *
     * @param {*} value The visit result.
     */
    #finishWithValue(value) {
      this.#ok     = true;
      this.#value  = (value instanceof VisitResult)
        ? value.value
        : value;
    }

    /**
     * Sets the visit result to be an error value. This indicates that the
     * visit has in fact finished with `ok === false`.
     *
     * @param {Error} error The visit error.
     */
    #finishWithError(error) {
      this.#ok    = false;
      this.#error = error;
    }
  };
}
