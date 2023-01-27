// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MustBe } from '@this/typey';

import { TreePathKey } from '#x/TreePathKey';
import { TreePathNode } from '#p/TreePathNode';


/**
 * Map from paths or partial paths to arbitrary bindings. A "path" in this case
 * is a series of zero or more string components, possibly followed by a
 * "wildcard" indicator which is meant to match zero or more additional path
 * components.
 *
 * This class implements several of the usual collection / map methods, in an
 * attempt to provide a useful and familiar interface.
 */
export class TreePathMap {
  /** @type {TreePathNode} The actual tree structure. */
  #rootNode = new TreePathNode();

  /**
   * @type {number} Total number of bindings. This is only maintained on a
   * root (publicly exposed) instance of this class (not on the instances that
   * are used internally in {@link #subtrees}).
   */
  #size = 0;

  /**
   * @type {function(TreePathKey): string} Function to use to render keys into
   * strings.
   */
  #keyStringFunc;

  /**
   * Constructs an empty instance.
   *
   * @param {?function(TreePathKey): string} [keyStringFunc = null] The function
   *   to use to render keys into strings. If `null`, this uses {@link
   *   TreePathKey#toString} with no arguments.
   */
  constructor(keyStringFunc = null) {
    this.#keyStringFunc = keyStringFunc
      ? MustBe.callableFunction(keyStringFunc)
      : (k) => k.toString();
  }

  /**
   * @returns {number} The count of bindings which have been added to this
   * instance.
   */
  get size() {
    return this.#size;
  }

  /**
   * Standard iteration protocol method. This is the same as calling {@link
   * #entries}.
   *
   * @returns {object} Iterator over the entries of this instance.
   */
  [Symbol.iterator]() {
    return this.#rootNode.entries();
  }

  /**
   * Adds a binding for the given key, failing if there is already a such a
   * binding. Note that it is valid for there to be both wildcard and
   * non-wildcard bindings simultaneously for any given path.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to bind.
   *   If `.wildcard` is `false`, then this method only binds the `.path`. If
   *   `key.wildcard` is `true`, then this method binds all paths with `.path`
   *   as a prefix, including `.path` itself.
   * @param {*} value Value to bind at `key`.
   * @throws {Error} Thrown if there is already a binding for the given `key`.
   */
  add(key, value) {
    const okay = this.#rootNode.add(key, value);

    if (okay) {
      this.#size++;
    } else {
      throw this.#makeError('Key already bound', key);
    }
  }

  /**
   * Gets an iterator over the entries of this instance, analogously to the
   * standard JavaScript `Map.entries()` method. The keys are all instances of
   * {@link TreePathKey}, more specifically the same instances that were used to
   * add mappings to this instance. The result is both an iterator and an
   * iterable (which, as with `Map.entries()`, returns itself).
   *
   * Unlike `Map`, this method does _not_ return an iterator which yields keys
   * in insertion order. Instead, iteration order is always preorder
   * depth-first, with visited subtrees sorted by key, and with non-wildcard
   * keys listed before wildcard keys within any given node.
   *
   * @returns {object} Iterator over the entries of this instance.
   */
  entries() {
    return this.#rootNode.entries();
  }

  /**
   * Finds the most-specific binding for the given path. Optionally produces
   * a chain of `next` results for less-and-less-specific bindings.
   *
   * Note that, given the same path, a non-wildcard binding is considered more
   * specific than a wildcard binding.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to look
   *   up. If `.wildcard` is `true`, then this method will only find bindings
   *   which are wildcards, though they might be more general than the `.path`
   *   being looked for.
   * @param {boolean} [wantNextChain = false] Should the return value have a
   *   `next` binding indicating the next-most-specific binding? If so,
   *   `next.next` will be similarly bound, and so on. The final element of the
   *   chain will have no binding for `next` (not even `null`).
   * @returns {?{key: TreePathKey, keyRemainder: TreePathKey, value: *}} The
   *   found result, or `null` if there was no match.
   *   * `{TreePathKey} key` -- The key that was matched; this is a wildcard key
   *     if the match was in fact a wildcard match, and likewise it is a
   *     non-wildcard key for an exact match. Furthermore, this is an object
   *     that was `add()`ed to this instance (and not, e.g., a "reconstructed"
   *     key).
   *   * `{TreePathKey} keyRemainder` -- The portion of the originally-given
   *     `key.path` that was matched by a wildcard, if this was in fact a
   *     wildcard match, in the form of a non-wildcard key. For non-wildcard
   *     matches, this is always an empty-path key.
   *   * `{object} next` -- The next-most-specific result, with bindings as
   *     described here. Only present if (a) `wantNextChain` was passed as
   *     `true` _and_ (b) there is in fact a next-most-specific result.
   *   * `{*} value` -- The bound value that was found.
   */
  find(key, wantNextChain = false) {
    return this.#rootNode.find(key, wantNextChain);
  }

  /**
   * Returns a new instance which is just like this one, except it will only
   * find keys which themselves match a given key. In the common case of passing
   * a wildcard key, this returns the subtree rooted at the given key, with the
   * key's path maintained in the result. If passed a non-wildcard key, then
   * this method returns the same value as {@link #find} would have, except in
   * the form of a single-binding instance of this class.
   *
   * For example, if passed a top-level wildcard key (e.g., `/*` in
   * filesystem-like syntax), then this method will effectively return a clone
   * of this instance because all bindings of this instance could potentially be
   * found by a key which matches the given key (which is to say, any key). If
   * instead passed a wildcard key with a non-empty path, then this method will
   * only return bindings with keys at or under that path.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to look
   *   up.
   * @returns {TreePathMap} Map of matched bindings.
   */
  findSubtree(key) {
    // See the note in docs of `TreePathNode.findSubtree()` for an explanation
    // about what's going on here.

    const result = new TreePathMap();

    this.#rootNode.findSubtree(key, (k, v) => result.add(k, v));
    return result;
  }

  /**
   * Finds the exact given binding. This will only find bindings that were added
   * with the exact same pair of `path` and `wildcard` as are being looked up.
   * This method might reasonably have been called `findExact`, but it is named
   * as it is because its functionality is the same as with the standard
   * JavaScript method on `Map` with the same name.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to look
   *   up.
   * @param {*} [ifNotFound = null] What to return if a binding is not found.
   * @returns {*} The value bound for the given `key`, or `ifNotFound` if there
   *   is no such binding.
   */
  get(key, ifNotFound = null) {
    return this.#rootNode.get(key, ifNotFound);
  }

  /**
   * Gets the string form of a key, as defined by the `keyStringFunc` passed in
   * (or implied by) the constructor call that created this instance.
   *
   * @param {TreePathKey} key The key.
   * @returns {string} The string form.
   */
  stringFromKey(key) {
    return this.#keyStringFunc(key);
  }

  /**
   * Returns an `Error` with a composed message, suitable for `throw`ing.
   *
   * @param {string} msg Basic message.
   * @param {TreePathKey} key Key in question.
   * @returns {Error} `Error` instance with composed.
   */
  #makeError(msg, key) {
    return new Error(`${msg}: ${this.stringFromKey(key)}`);
  }
}
