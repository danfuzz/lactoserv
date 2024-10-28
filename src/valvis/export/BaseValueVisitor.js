// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { types } from 'node:util';

import { AskIf, MustBe } from '@this/typey';

import { BaseDefRef } from '#x/BaseDefRef';
import { VisitDef } from '#x/VisitDef';
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
 * {@link #visitSync} or {@link #visitAsyncWrap} (but not normal asynchronous
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
   * The root value to be visited (or currently being visited).
   *
   * @type {*}
   */
  #rootValue;

  /**
   * Map from each visited value to its visit-representing entry.
   *
   * @type {Map<*, BaseValueVisitor#VisitEntry>}
   */
  #visitEntries = new Map();

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
  #activeVisits = new Set();

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
   * Gets the visit result corresponding to a value that was encountered during
   * the visit. This works for either the original {@link #rootValue} or any
   * value it refers to and was visited.
   *
   * @param {*} value The value that was visited (either the main visit or a
   *   sub-visit).
   * @returns {*} The result of the visit.
   * @throws {Error} Thrown if the visit is still in progress or has not yet
   *   started, _or_ if `value` was never visited.
   */
  getVisitResult(value) {
    this.#throwIfNotFinished();

    const entry = this.#visitEntries.get(value);

    if (!entry) {
      throw new Error('Value was not visited.');
    }

    return entry.extractSync();
  }

  /**
   * Indicates whether or not the visit represented by this instance resulted in
   * the creation of any refs.
   *
   * @returns {boolean} `true` if the visit caused refs to be created, or
   *  `false` if not.
   * @throws {Error} Thrown if the visit is still in progress or has not yet
   *   started.
   */
  hasRefs() {
    this.#throwIfNotFinished();

    const allRefs = this.#allRefs;

    if (this.#allRefs instanceof Map) {
      return (allRefs.size > 0);
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
   * Is the visit of the top-level {@link #value} finished? This returns `false`
   * until the visit is complete. This includes returning `false` before the
   * initial call to a `visit*()` method.
   *
   * @returns {boolean} `true` if the visit is finsihed, or `false` if it is
   *   either in-progress or hasn't yet started.
   */
  isFinished() {
    const entry = this.#rootEntry;

    return entry
      ? entry.isFinished()
      : false;
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
   * @throws {Error} Thrown if the visit is still in progress or has not yet
   *   started.
   */
  refFromResultValue(value) {
    // Note: The first call to `hasRefs()` after a visit finishes will cause
    // `allRefs` to be converted into a `Map`.
    return this.hasRefs()
      ? this.#allRefs.get(value)
      : null;
  }

  /**
   * Similar to {@link #visitWrap}, except (a) it will fail if the visit did not
   * finish synchronously; and (b) the result is not wrapped. Specifically with
   * respect to (b), if a promise is returned, it is only ever
   * because an `_impl_visit*()` method returned a promise result per se (and
   * not because a visitor acted asynchronously).
   *
   * @returns {*} Whatever result was returned from the `_impl_*()` method which
   *   processed the original `value`.
   * @throws {Error} Thrown if there was trouble with the visit which could be
   *   determined synchronously, _or_ if the visit could not be completed
   *   synchronously.
   */
  visitSync() {
    return this.#visitRoot().extractSync();
  }

  /**
   * Visits this instance's designated value by calling through to the various
   * `_impl_*()` methods as necessary (and as defined by the concrete subclass),
   * synchronously if possible or asynchronously if not. That is, if all of the
   * `_impl_*()` methods act synchronously, then this method returns
   * synchronously with a result; but if any of the called methods returns a
   * promise, then this method in turn returns a promise. In all cases, an
   * ultimately successful return value is an instance of {@link VisitResult},
   * which wraps the actual result value and can be queried for it. (This
   * wrapping is made necessary because otherwise a result which is a promise
   * would be mistaken for an asynchronous visit.)
   *
   * If this method is called more than once on any given instance, the visit
   * procedure is only actually run once; subsequent calls reuse the return
   * value from the first call, even if the first call is still in progress at
   * the time of the call.
   *
   * @returns {VisitResult|Promise<VisitResult>} Whatever result was returned
   *   from the `_impl_*()` method which processed the original `value`.
   * @throws {Error} Thrown if there was trouble with the visit which could be
   *   determined synchronously.
   */
  visitWrap() {
    const entry = this.#visitRoot();

    return entry.isFinished()
      ? entry.extractSync(true)
      : entry.extractAsync(true);
  }

  /**
   * Like {@link #visitWrap}, except that it always operates asynchronously.
   *
   * @returns {VisitResult} Whatever result was returned from the `_impl_*()`
   *   method which processed the original `value`.
   * @throws {Error} Thrown if there was trouble with the visit.
   */
  async visitAsyncWrap() {
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
   * "Revisits" a value that has been encountered before during the visit. This
   * is called during a visit on the second and subsequent times a particular
   * value has been encountered, including when encountered as part of a
   * reference cycle.
   *
   * The return value of this method is not used to construct the ultimate visit
   * result. Instead, this method's purpose is to enable concrete visitor
   * classes to cause side effects in reaction to revisits. As such, the base
   * implementation of this method does nothing.
   *
   * @param {*} node The original value which has now been encountered at least
   *   twice.
   * @param {*} resultValue The result value from the completed original visit
   *   to node. This will be `null` if the call to this method is taking place
   *   at the moment of reference cycle detection.
   * @param {boolean} isCycleHead `true` if `node` has been detected as the
   *   "head" (first-encountered value) of a reference cycle, or `false` if not.
   *   When `false`, the `node` _might_ still be part of a cycle, but it wasn't
   *   specifically the detected head of the cycle.
   * @param {?VisitRef} ref The ref instance which represents `node`, if any.
   *   This is non-`null` when {@link #_impl_shouldRef} returned `true` for
   *   `node` _and_ this call wasn't made at the moment of reference cycle
   *   detection.
   */
  _impl_revisit(node, resultValue, isCycleHead, ref) { // eslint-disable-line no-unused-vars
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
   * {@link #_prot_visitProperties}.
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
   * visit the contents can do so by calling {@link #_prot_visitProperties}.
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
   * Visits the given value as a "sub-visit" of the main visit. This can be used
   * in concrete subclasses, for example, to visit the various pieces of
   * instances, where a simple object property visit wouldn't suffice.
   *
   * This method returns synchronously if possible, or asynchronously if not. As
   * such, it always returns a result wrapped in a {@link VisitResult}, so that
   * returned promises can always be distinguished from promises due to the
   * asynchronous nature of a visit.
   *
   * @param {*} node Value to visit.
   * @returns {VisitResult|Promise<VisitResult>} The visit result if
   * synchronously available, or a promise for the result if not.
   */
  _prot_visitWrap(node) {
    const entry = this.#visitNode(node);

    return entry.isFinished()
      ? entry.extractSync(true)
      : entry.extractAsync(true);
  }

  /**
   * Visits the "own" property values of an object, typically a plain object or
   * array. Returns either an array (if given an array or if asked for entries)
   * or a `null`-prototype plain object (if given a non-array object and _not_
   * asked for entries), consisting of all the visited values, with property
   * names / indexes corresponding to the original.
   *
   * Some special cases:
   *
   * * If the given `node` has synthetic properties, this method will call those
   *   properties' getters.
   * * If the original `node` is a sparse array, the result will have the same
   *   "holes."
   * * If `returnEntries` is passed as `true` and `node` is an array, it _will_
   *   have a result entry for `length`. Furthermore, the `length` will be in
   *   the result between indexed properties and named properties, just as with
   *   `Object.getOwnPropertyNames()`.
   *
   * @param {object} node The node whose contents are to be visited.
   * @param {boolean} [returnEntries] Return an array of two-element entry
   *   arrays (a la `Object.entries()`) instead of a direct array or plain
   *   object?
   * @returns {object|Array|Promise} The visited results as an array or
   *   `null`-prototype plain object, or a promise for same in the case where
   *   any of the visitor methods act asynchronously.
   */
  _prot_visitProperties(node, returnEntries = false) {
    const isArray    = Array.isArray(node);
    const skipLength = isArray && !returnEntries;
    const propArrays = [
      Object.getOwnPropertyNames(node),
      Object.getOwnPropertySymbols(node)
    ];

    const result = (() => {
      if (returnEntries) return [];
      else if (isArray)  return Array(node.length);
      else               return Object.create(null);
    })();
    const addResult = (name, entry) => {
      const value = entry.extractSync();
      if (returnEntries) result.push([name, value]);
      else               result[name] = value;
    };

    // We do this in an async IIFE, so that in the case of actually-synchronous
    // completion, we can return or throw the non-Promise result.
    let isAsync = false;
    let error   = null;
    const resultProm = (async () => {
      for (const propArray of propArrays) {
        for (const name of propArray) {
          if (skipLength && (name === 'length')) {
            // **Note:** This test is needed because `Object.getOwnProperties()`
            // on an array includes `length`, and we _don't_ want to end up
            // calling `result.length = <whatever>`.
            continue;
          }

          const entry = this.#visitNode(node[name]);
          if (entry.isFinished()) {
            try {
              addResult(name, entry);
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
            addResult(name, await entry.promise);
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
   * @returns {?BaseValueVisitor#VisitEntry} The entry corresponding to
   * {@link #rootValue}, or `null` if it hasn't yet been created (which means
   * that the visit hasn't started yet).
   */
  get #rootEntry() {
    return this.#visitEntries.get(this.#rootValue);
  }

  /**
   * Is the given value a def or ref that was produced by this instance?
   *
   * @param {*} value The value in question.
   * @returns {boolean} `true` iff `value` is a def or ref that was produced by
   *   this instance.
   */
  #isAssociatedDefOrRef(value) {
    return (value instanceof BaseDefRef)
      && (value[BaseValueVisitor.#SYM_associatedVisitor] === this);
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
   * Throws an error indicating that the visit either hasn't started yet or
   * hasn't finished yet, if either of those are the case. If the visit has
   * finished, then this does nothing.
   */
  #throwIfNotFinished() {
    if (!this.isFinished()) {
      const verb = this.#rootEntry ? 'finished' : 'started';
      throw new Error(`Visit has not yet ${verb}. (Call a \`visit*()\` method.)`);
    }
  }

  /**
   * Visitor for a "node" (referenced value, including possibly the root) of the
   * graph of values being visited. If there is already an entry in
   * {@link #visitEntries} for the node, it is returned. Otherwise, a new entry
   * is created, and visiting is initiated (and possibly, but not necessarily,
   * finished).
   *
   * @param {*} node The node being visited.
   * @returns {BaseValueVisitor#VisitEntry} Entry from {@link #visitEntries}
   *   which represents the current state of the visit.
   */
  #visitNode(node) {
    const already = this.#visitEntries.get(node);

    if (already) {
      let ref = already.ref;

      if (ref || already.shouldRef()) {
        // We either already have a ref, or we are supposed to make a ref.

        const isCycleHead = !already.isFinished();
        const result      = isCycleHead ? null : already.extractSync();

        if (!ref) {
          already.setDefRef(this.#allRefs.length);
          ref = already.ref;
          this.#allRefs.push(ref);
          this._impl_newRef(ref);
        }

        this._impl_revisit(node, result, isCycleHead, ref);
        return this.#visitNode(ref);
      } else if (this.#activeVisits.has(already)) {
        // We have encountered the head of a reference cycle that was _not_
        // handled by making a "ref" object for the back-reference.

        // We mark the entry as circular, which ultimately propagates the
        // appropriate error back to the first node involved in the cycle. Note
        // that this method isn't ever supposed to throw, which is why we don't
        // just `throw` directly here.
        already.becomeCircular();
        return already;
      } else {
        // This is a revisit of a value for which `_impl_shouldRef()` returned
        // `false`.
        if (!this.#isAssociatedDefOrRef(node)) {
          // Only call `revisit()` if it's not a self-associated ref/def.
          this._impl_revisit(node, already.extractSync(), false, null);
        }
        return already;
      }
    }

    // We have not previously encountered `node` during this visit.

    const visitEntry = new BaseValueVisitor.#VisitEntry(this, node);
    this.#visitEntries.set(node, visitEntry);

    // This call synchronously calls back to `visitNode0()`.
    visitEntry.startVisit();

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
        } else if (this.#isAssociatedDefOrRef(node)) {
          // This is a def or ref constructed by this instance, so they are just
          // returned as-is. (But if they're defs or refs associated with a
          // different visitor, they're treated as regular instances.)
          return node;
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
   * Gets the entry for the root value being visited, including starting the
   * visit (and possibly completing it) if this is the first time a `visit*()`
   * method is being called.
   *
   * @returns {BaseValueVisitor#VisitEntry} Vititor entry for the root value.
   */
  #visitRoot() {
    // Note: This isn't _just_ `return this.#visitNode(this.#rootValue)`,
    // because that would end up invoking the def/ref mechanism, which would be
    // incorrect to do in this case (because we're not trying to possibly-share
    // a result within the visit, just trying to _get_ the result).

    return this.#rootEntry ?? this.#visitNode(this.#rootValue);
  }


  //
  // Static members
  //

  /**
   * Uninterned symbol used for "secret" property on defs and refs which stores
   * the associated visitor instance.
   *
   * @type {symbol}
   */
  static #SYM_associatedVisitor = Symbol('BaseValueVisitor.associatedVisitor');

  /**
   * Entry in a {@link #visitEntries} map.
   */
  static #VisitEntry = class VisitEntry {
    /**
     * The associated visitor ("outer `this`").
     *
     * @type {BaseValueVisitor}
     */
    #visitor;

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
     * Should repeat visits to this entry's value result in refs? `null` if not
     * yet determined.
     *
     * @type {?boolean}
     */
    #shouldRef = null;

    /**
     * Def which corresponds to this instance, or `null` if there is none.
     *
     * @type {?VisitDef}
     */
    #def = null;

    /**
     * Constructs an instance.
     *
     * @param {BaseValueVisitor} visitor The visitor instance ("outer `this`")
     *   which is creating this instance.
     * @param {*} node The value whose visit is being represented.
     */
    constructor(visitor, node) {
      this.#visitor = visitor;
      this.#node    = node;
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
     * @returns {?VisitDef} Def which corresponds to this instance, or `null` if
     * there is none.
     */
    get def() {
      return this.#def;
    }

    /**
     * @returns {?VisitRef} Ref which corresponds to this instance, or `null` if
     * there is none.
     */
    get ref() {
      return this.#def?.ref ?? null;
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
     * difference between {link #visit} and {@link #visitAsyncWrap} (see which).
     *
     * @param {boolean} [wrapResult] Should a successful result be wrapped?
     * @returns {*} The successful result of the visit, if it was indeed
     *   successful.
     * @throws {Error} The error resulting from the visit, if it failed.
     */
    async extractAsync(wrapResult = false) {
      if (!this.isFinished()) {
        // Wait for the visit to finish, either successfully or not. This should
        // never throw.
        await this.#promise;
      }

      return this.extractSync(wrapResult);
    }

    /**
     * Synchronously extracts the result or error of a visit.
     *
     * @param {boolean} [wrapResult] Should a successful result be wrapped?
     * @returns {*} The successful result of the visit, if it was indeed
     *   successful.
     * @throws {Error} The error resulting from the visit, if it failed; or an
     *   error indicating that the visit is still in progress.
     */
    extractSync(wrapResult = false) {
      if (this.isFinished()) {
        if (this.#ok) {
          return wrapResult
            ? new VisitResult(this.#value)
            : this.#value;
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
     * Creates and stores a def and ref which are to correspond to this
     * instance, assigning them the indicated index. It is only valid to ever
     * call this method once on any given instance.
     *
     * @param {number} index The index for the ref.
     */
    setDefRef(index) {
      if (this.#def) {
        /* c8 ignore start */
        // This is indicative of a bug in this class.
        throw new Error('Shouldn\'t happen: Def and ref already set.');
      }
      /* c8 ignore stop */

      const valueArg = this.isFinished() ? [this.extractSync()] : [];

      this.#def = new VisitDef(index, ...valueArg);

      const propArgs = [BaseValueVisitor.#SYM_associatedVisitor, { value: this.#visitor }];
      Object.defineProperty(this.#def, ...propArgs);
      Object.defineProperty(this.#def.ref, ...propArgs);
    }

    /**
     * Assuming this is its second-or-later (recursive or sibling) visit, should
     * the value associated with this instance be turned into a ref? This just
     * defers to {@link #_impl_shouldRef}, after filtering out anything which
     * should never be considered for reffing, and caches the result so that
     * {@link #_impl_shouldRef} is never called more than once per original
     * value.
     *
     * @returns {boolean} `true` iff repeat visits to this instance should
     *   result in a ref to this instance's result.
     */
    shouldRef() {
      if (this.#shouldRef === null) {
        const visitor = this.#visitor;
        const node    = this.#node;
        let   result  = false;

        switch (typeof node) {
          case 'bigint':
          case 'function':
          case 'string':
          case 'symbol': {
            result = visitor._impl_shouldRef(node); // eslint-disable-line no-restricted-syntax

            break;
          }

          case 'object': {
            if ((node !== null) && !visitor.#isAssociatedDefOrRef(node)) {
              result = visitor._impl_shouldRef(node); // eslint-disable-line no-restricted-syntax
            }
            break;
          }
        }

        this.#shouldRef = result;
      }

      return this.#shouldRef;
    }

    /**
     * Starts the visit for this instance. If the visit could be synchronously
     * finished, the instance state will reflect that fact upon return. If not,
     * the visit will continue asynchronously, after this method returns.
     */
    startVisit() {
      // Note: See the implementation of `.promise` for an important detail
      // about circular references.
      this.#promise = (async () => {
        const visitor = this.#visitor;
        visitor.#activeVisits.add(this);

        try {
          let result = visitor.#visitNode0(this.#node);

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

        visitor.#activeVisits.delete(this);

        return this;
      })();
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

      if (this.#def && !this.#def.isFinished()) {
        this.#def.finishWithValue(error);
      }
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

      if (this.#def && !this.#def.isFinished()) {
        this.#def.finishWithValue(this.#value);
      }
    }
  };
}
