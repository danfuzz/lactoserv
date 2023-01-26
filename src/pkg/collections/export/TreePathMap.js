// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MustBe } from '@this/typey';

import { TreePathKey } from '#x/TreePathKey';


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
  /**
   * @type {Map<string, TreePathMap>} Bindings from each initial path component
   * to a {@link TreePathMap} instance which contains mappings for that
   * component.
   */
  #subtrees = new Map();

  /**
   * @type {number} Total number of bindings. This is only maintained on a
   * root (publicly exposed) instance of this class (not on the instances that
   * are used internally in {@link #subtrees}).
   */
  #size = 0;

  /**
   * @type {TreePathKey} Non-wildcard key (from the root), if there is an
   * empty-path binding to this instance.
   */
  #emptyKey = null;

  /** @type {*} Empty-path binding. */
  #emptyValue = null;

  /**
   * @type {TreePathKey} Wildcard key (from the root), if there is a wildcard
   * binding to this instance.
   */
  #wildcardKey = null;

  /** @type {*} Wildcard binding. */
  #wildcardValue = null;

  /**
   * Constructs an empty instance.
   */
  constructor() {
    // Nothing to do here.
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
    return this.entries();
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
   * @throws {Error} Thrown if there is already a binding for the given `key`
   *   (taking into account both `path` _and_ `wildcard`).
   */
  add(key, value) {
    if (! (key instanceof TreePathKey)) {
      MustBe.arrayOfString(key.path);
      MustBe.boolean(key.wildcard);
    }

    this.#add0(key, value);
    this.#size++;
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
    return this.#iteratorAt([]);
  }

  /**
   * Finds the most-specific binding for the given path.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to look
   *   up. If `.wildcard` is `true`, then this method will only find bindings
   *   which are wildcards, though they might be more general than the `.path`
   *   being looked for.
   * @returns {?{key: TreePathKey, keyRemainder: TreePathKey, value: *}} Details
   *   about the found result, or `null` if there was no match.
   *   * `{TreePathKey} key` -- The key that was matched; this is a wildcard key
   *     if the match was in fact a wildcard match, and likewise it is a
   *     non-wildcard key for an exact match. Furthermore, this is an object
   *     that was `add()`ed to this instance (and not, e.g., a "reconstructed"
   *     key).
   *   * `{TreePathKey} keyRemainder` -- The portion of the originally-given
   *     `key.path` that was matched by a wildcard, if this was in fact a
   *     wildcard match, in the form of a non-wildcard key. For non-wildcard
   *     matches, this is always an empty-path key.
   *   * `{*} value` -- The bound value that was found.
   */
  find(key) {
    const { path, wildcard } = key;

    if (! (key instanceof TreePathKey)) {
      MustBe.arrayOfString(path);
      MustBe.boolean(wildcard);
    }

    return this.#find0(path, wildcard);
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
    const { path, wildcard } = key;
    const result             = new TreePathMap();

    if (! (key instanceof TreePathKey)) {
      MustBe.arrayOfString(path);
      MustBe.boolean(wildcard);
    }

    if (!wildcard) {
      // Non-wildcard is easy, because `find()` already does the right thing.
      const found  = this.find(key);
      if (found !== null) {
        result.add(key, found.value);
      }
      return result;
    }

    // Wildcard case: Walk `subtrees` down to the one we want, and then -- if
    // found -- iterate over it to build up the result.

    let subtree = this;

    for (const p of path) {
      subtree = subtree.#subtrees.get(p);
      if (!subtree) {
        // No bindings match the given key. `result` is already empty; just
        // return it.
        return result;
      }
    }

    for (const [k, v] of subtree.#iteratorAt(path)) {
      result.add(k, v);
    }

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
    if (! (key instanceof TreePathKey)) {
      MustBe.arrayOfString(key.path);
      MustBe.boolean(key.wildcard);
    }

    let subtree = this;

    for (const p of key.path) {
      subtree = subtree.#subtrees.get(p);
      if (!subtree) {
        return ifNotFound;
      }
    }

    if (key.wildcard) {
      return subtree.#wildcardKey ? subtree.#wildcardValue : ifNotFound;
    } else {
      return subtree.#emptyKey ? subtree.#emptyValue : ifNotFound;
    }
  }

  /**
   * Helper for {@link #add}, which does most of the work.
   *
   * @param {TreePathKey} key Key to bind.
   * @param {*} value Value to bind.
   * @throws {Error} Thrown if there is already a binding `key`.
   */
  #add0(key, value) {
    let subtree = this;

    // Add any required subtrees to represent `key.path`, leaving `subtree` as
    // the instance to modify.
    for (const p of key.path) {
      let nextSubtree = subtree.#subtrees.get(p);
      if (!nextSubtree) {
        nextSubtree = new TreePathMap();
        subtree.#subtrees.set(p, nextSubtree);
      }
      subtree = nextSubtree;
    }

    // Put a new binding directly into `subtree`, or report the salient problem.
    if (key.wildcard) {
      if (subtree.#wildcardKey) {
        throw this.#errorMessage('Path already bound', key);
      }
      subtree.#wildcardKey   = key;
      subtree.#wildcardValue = value;
    } else {
      if (subtree.#emptyKey) {
        throw this.#errorMessage('Path already bound', key);
      }
      subtree.#emptyKey   = key;
      subtree.#emptyValue = value;
    }
  }

  /**
   * Returns a composed error message, suitable for `throw`ing.
   *
   * @param {string} msg Basic message.
   * @param {TreePathKey} key Key in question.
   * @returns {string} The composed error message.
   */
  #errorMessage(msg, key) {
    return key.toString({
      prefix:    `${msg}: [`,
      suffix:    ']',
      quote:     true,
      separator: ', '
    });
  }

  /**
   * Helper for {@link #find}, which does most of the work.
   *
   * @param {string[]} path Path to look up.
   * @param {boolean} wildcard Must the result be a wildcard binding?
   * @returns {?object} Result as described by {@link #find}.
   */
  #find0(path, wildcard) {
    let subtree    = this;
    let foundAt    = -1;
    let foundKey   = null;
    let foundValue = null;

    let at;
    for (at = 0; at < path.length; at++) {
      if (subtree.#wildcardKey) {
        foundAt    = at;
        foundKey   = subtree.#wildcardKey;
        foundValue = subtree.#wildcardValue;
      }
      subtree = subtree.#subtrees.get(path[at]);
      if (!subtree) {
        break;
      }
    }

    if (at === path.length) {
      if (subtree.#emptyKey && !wildcard) {
        // There's an exact match for the path.
        return {
          key:          subtree.#emptyKey,
          keyRemainder: TreePathKey.EMPTY,
          value:        subtree.#emptyValue
        };
      } else if (subtree.#wildcardKey) {
        // There's a matching wildcard at the end of the path.
        return {
          key:          subtree.#wildcardKey,
          keyRemainder: TreePathKey.EMPTY,
          value:        subtree.#wildcardValue
        };
      }
    } else if (foundAt >= 0) {
      return {
        key:          foundKey,
        keyRemainder: new TreePathKey(Object.freeze(path.slice(foundAt)), false),
        value:        foundValue
      };
    }

    return null;
  }

  /**
   * Helper for the iteration methods: Returns a generator which iterates over
   * all bindings of this instance, yielding entries where the `path` part of
   * the key is prepended with the given `path` value.
   *
   * @param {string[]} pathPrefix Path to prepend to the `path` part of the key
   *   in all yielded results.
   * @yields {object} The next binding of this instance, with key modified as
   *   described above.
   */
  *#iteratorAt(pathPrefix) {
    if (this.#emptyKey) {
      yield ([this.#emptyKey, this.#emptyValue]);
    }

    if (this.#wildcardKey) {
      yield ([this.#wildcardKey, this.#wildcardValue]);
    }

    // Sort the entries, to maintain the iteration order contract.
    const entries = [...this.#subtrees];
    entries.sort((x, y) => (x[0] < y[0]) ? -1 : 1);

    for (const [pathComponent, subtree] of entries) {
      yield* subtree.#iteratorAt([...pathPrefix, pathComponent]);
    }
  }
}
