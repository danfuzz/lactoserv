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
   * During a visit, an array of all refs created during the visit, in order of
   * creation; after the first post-visit call to {@link #hasRefs} or
   * {@link #refFromResultValue}, a map from each result value with a ref to its
   * corresponding ref.
   *
   * @type {Array<VisitRef>|Map<*, VisitRef>}
   */
  #allRefs = [];

  /**
   * The set of visit entries that are actively being visited. This is used to
   * detect attempts to visit a value containing a circular reference.
   *
   * @type {Set<BaseValueVisitor#VisitEntry>}
   */
  #visitSet = new Set();

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
   * Indicates whether or not the visit represented by this instance resulted in
   * the creation of any refs.
   *
   * @returns {?boolean} `true` if the visit caused refs to be created, `false`
   *   if not, or `null` if the visit is still in-progress.
   */
  hasRefs() {
    const allRefs = this.#allRefs;

    if (this.#allRefs instanceof Map) {
      return (allRefs.size > 0);
    } else if (!this.#visitRoot().isFinished()) {
      // The visit is still in progress.
      return null;
    }

    // This is the first post-visit call to this method, so we can (and do) now
    // initialize `allRefs`.

    const refMap = new Map();
    for (const ref of allRefs) {
      refMap.set(ref.value, ref);
    }

    this.#allRefs = refMap;
    return (refMap.size > 0);
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
    // Note: The first call to `hasRefs()` after a visit finishes will cause
    // `allRefs` to be converted into a `Map`.
    return this.hasRefs()
      ? this.#allRefs.get(value)
      : null;
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
   * Similar to {@link #visit}, except (a) it will fail if the visit did not
   * finish synchronously; and (b) if a promise is returned, it is only ever
   * because a visitor returned a promise per se (and not from a visitor acting
   * asynchronously).
   *
   * @returns {*} Whatever result was returned from the `_impl_*()` method which
   * processed the original `value`.
   */
  visitSync() {
    return this.#visitRoot().extractSync();
  }

  /**
   * Like {@link #visit}, except that successful results are wrapped in an
   * instance of {@link VisitResult}, which makes it possible for a caller to
   * tell the difference between a promise which is returned because the visitor
   * is acting asynchronously and a promise which is returned because it is an
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
   * Indicates that a new ref has been created. This is called while a visit is
   * in-progress. In the case of a ref to a value which circularly refers to
   * itself, this method is called _before_ the (sub-)visit of the value is
   * complete. In the case of a ref to a value which is not self-referential,
   * this method is called _after_ the (sub-)visit of the value is complete;
   * more specifically it is called just after it is discovered to be shared.
   *
   * The base implementation of this method does nothing.
   *
   * @param {VisitRef} ref The ref that was created.
   */
  _impl_newRef(ref) { // eslint-disable-line no-unused-vars
    // @emptyBlock
  }

  /**
   * Indicates whether the given value, which has already been determined to be
   * referenced more than once in the graph of values being visited, should be
   * converted into a ref object for all but the first visit. The various
   * `visit*()` methods will call this any time they encounter a value (of an
   * appropriate type) which has been visited before (or is currently being
   * visited).
   *
   * The values for which this are called are those whose type admits the
   * possibility of identity (that is, for which `===` can distinguish between
   * seemingly-identical values), and those whose types do not limit the amount
   * of storage used. This includes the following types:
   *
   * * `bigint`
   * * `object`, except:
   *   * not the value `null`
   *   * not any instance of {@link #VisitRef}
   * * `function`
   * * `string`
   * * `symbol`
   *
   * Note that, for values that are visited recursively and have at least one
   * self-reference (that is, a circular reference), returning `false` will
   * cause the visit to _not_ be able to finish, in that the construction of a
   * visit result will require the result itself to be known before its own
   * construction.
   *
   * The base implementation of this method always returns `false`. A common
   * choice for a subclass is to return `true` for objects and functions and
   * `false` for everything else.
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
   * Visits an instance of `Error` or any subclass thereof. This method exists
   * because it is common to want to treat error objects differently than other
   * sorts of instances and in a uniform-to-errors way. The base implementation
   * defers to {@link #_impl_visitInstance}.
   *
   * @param {Error} node The node to visit.
   * @returns {*} Arbitrary result of visiting.
   */
  _impl_visitError(node) {
    return this._impl_visitInstance(node);
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
   * `Object` and which wasn't instead visited by one of the other more specific
   * instance visitors (or where such visitors decided to just pass the work
   * here). The base implementation returns the given `node` as-is.
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
  _prot_labelFromValue(value) {
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
  _prot_nameFromValue(value) {
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
   * {@link #_impl_shouldRef}, after filtering out anything which should never
   * be considered for reffing.
   *
   * @param {*} value Value to check.
   * @returns {boolean} `true` iff `value` should be turned into a ref.
   */
  #shouldRef(value) {
    switch (typeof value) {
      case 'bigint':
      case 'function':
      case 'string':
      case 'symbol': {
        return this._impl_shouldRef(value);
      }

      case 'object': {
        return ((value === null) || (value instanceof VisitRef))
          ? false
          : this._impl_shouldRef(value);
      }

      default: {
        return false;
      }
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
      const ref = already.ref;
      if (ref) {
        return this.#visitNode(ref);
      } else if (this.#shouldRef(node)) {
        const newRef = already.setRef(this.#allRefs.length);
        this.#allRefs.push(newRef);
        this._impl_newRef(newRef);
        return this.#visitNode(newRef);
      } else if (this.#visitSet.has(already)) {
        // Note that this method isn't ever supposed to throw. What we do here
        // is mark the entry as being part of a reference cycle, which
        // ultimately propagates the appropriate error back to the first node
        // involved in the cycle.
        already.becomeCircular();
        return already;
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
        } else if (node instanceof Error) {
          return this._impl_visitError(node);
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
    const isArray    = Array.isArray(result);
    const propArrays = [
      Object.getOwnPropertyNames(node),
      Object.getOwnPropertySymbols(node)
    ];

    // We do this in an async IIFE, so that in the case of actually-synchronous
    // completion, we can return or throw the non-Promise result.
    let isAsync = false;
    let error   = null;
    const resultProm = (async () => {
      for (const propArray of propArrays) {
        for (const name of propArray) {
          if (isArray && (name === 'length')) {
            continue;
          }

          const entry = this.#visitNode(node[name]);
          if (entry.isFinished()) {
            try {
              result[name] = entry.extractSync();
            } catch (e) {
              if (isAsync) {
                // Propagate the error to `resultProm`.
                throw e;
              } else {
                // Arrange for the synchronous call to throw this error.
                error = e;
                break;
              }
            }
          } else {
            isAsync = true;
            result[name] = (await entry.promise).extractSync();
          }
        }
      }

      return result;
    })();

    if (isAsync) {
      return resultProm;
    } else if (error) {
      throw error;
    } else {
      return result;
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
     * has been finished (whether or not successful).
     */
    get promise() {
      /* c8 ignore start */
      if (!this.#promise) {
        // This is indicative of a bug in this class: This means that the IIFE
        // call inside `startVisit()` on this instance hasn't yet finished,
        // which is indicative of a reference cycle. However, that case _should_
        // have been handled by the `visitSet`-related work in `visitNode()`,
        // before anything got to the point of asking for this promise.
        throw new Error('Shouldn\'t happen: Cannot get promise yet.');
      }
      /* c8 ignore end */

      return this.#promise;
    }

    /**
     * @returns {?VisitRef} Ref which corresponds to this instance, or `null` if
     * there is none.
     */
    get ref() {
      return this.#ref;
    }

    /**
     * Indicates that this instance represents the initial node detected in a
     * reference cycle.
     */
    becomeCircular() {
      this.#finishWithError(
        new Error('Visit is deadlocked due to circular reference.'));
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
     * @returns {*} The successful result of the visit, if it was indeed
     *   successful.
     * @throws {Error} The error resulting from the visit, if it failed; or an
     *   error indicating that the visit is still in progress.
     */
    extractSync() {
      if (this.isFinished()) {
        if (this.#ok) {
          return this.#value;
        } else {
          throw this.#error;
        }
      } else {
        throw new Error('Visit did not finish synchronously.');
      }
    }

    /**
     * Returns an indication of whether the visit has finished.
     *
     * @returns {boolean} `true` if the visit of the referenced value is
     *   finished, or `false` if it is still in-progress.
     */
    isFinished() {
      return (this.#ok !== null);
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
        /* c8 ignore start */
        // This is indicative of a bug in this class.
        throw new Error('Shouldn\'t happen: Ref already set.');
      }
      /* c8 ignore stop */

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
        outerThis.#visitSet.add(this);

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

        outerThis.#visitSet.delete(this);

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
     * Sets the visit result to be an error value. This indicates that the visit
     * has in fact finished with `ok === false`.
     *
     * @param {Error} error The visit error.
     */
    #finishWithError(error) {
      this.#ok    = false;
      this.#error = error;
    }
  };
}
