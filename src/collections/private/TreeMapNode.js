// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { PathKey } from '#x/PathKey';
import { TreeMap } from '#x/TreeMap';
import { TypePathKey } from '#x/TypePathKey';


/**
 * Node within a {@link TreeMap}. This class contains practically all of the
 * main tree manipulation and access logic for that class.
 */
export class TreeMapNode {
  /**
   * Bindings from each initial path component to a {@link TreeMapNode} which
   * contains mappings for that component.
   *
   * @type {Map<string, TreeMapNode>}
   */
  #subtrees = new Map();

  /**
   * Non-wildcard key (from the root), if there is an empty-path binding to this
   * instance.
   *
   * @type {PathKey}
   */
  #emptyKey = null;

  /**
   * Empty-path binding.
   *
   * @type {*}
   */
  #emptyValue = null;

  /**
   * Wildcard key (from the root), if there is a wildcard binding to this
   * instance.
   *
   * @type {PathKey}
   */
  #wildcardKey = null;

  /**
   * Wildcard binding.
   *
   * @type {*}
   */
  #wildcardValue = null;

  // @defaultConstructor

  /**
   * Underlying implementation of `TreeMap.add()`, see which for detailed
   * docs. Note the different return-vs-throw behavior compared to the exposed
   * method.
   *
   * @param {TypePathKey} key Key to bind.
   * @param {*} value Value to bind at `key`.
   * @returns {boolean} `true` if the binding was added, or `false` if there was
   *   already a binding for `key`.
   */
  add(key, value) {
    const { path, wildcard } = key;

    if (!(key instanceof PathKey)) {
      MustBe.arrayOfString(path);
      MustBe.boolean(wildcard);
    }

    let subtree = this;

    // Add any required subtrees to represent `path`, leaving `subtree` as the
    // instance to modify.
    for (const p of path) {
      let nextSubtree = subtree.#subtrees.get(p);
      if (!nextSubtree) {
        nextSubtree = new TreeMapNode();
        subtree.#subtrees.set(p, nextSubtree);
      }
      subtree = nextSubtree;
    }

    // Put a new binding directly into `subtree`, or report the salient problem.
    if (wildcard) {
      if (subtree.#wildcardKey) {
        return false;
      }
      subtree.#wildcardKey   = key;
      subtree.#wildcardValue = value;
    } else {
      if (subtree.#emptyKey) {
        return false;
      }
      subtree.#emptyKey   = key;
      subtree.#emptyValue = value;
    }

    return true;
  }

  /**
   * Underlying implementation of `TreeMap.findSubtree()`, see which for
   * detailed docs.
   *
   * @param {TypePathKey} key Key to search for.
   * @param {object} result Result to add to. (It's a `TreeMap`, but we
   *   don't name the type here to avoid a circular dependency.)
   */
  addSubtree(key, result) {
    const { path, wildcard } = key;

    if (!(key instanceof PathKey)) {
      PathKey.checkArguments(path, wildcard);
    }

    if (!wildcard) {
      // Non-wildcard is easy, because `find()` already does the right thing.
      const found = this.find(key);
      if (found !== null) {
        result.add(key, found.value);
      }
      return;
    }

    // Wildcard case: Walk `subtrees` down to the one we want, and then -- if
    // found -- iterate over it to build up the result.

    let subtree = this;

    for (const p of path) {
      subtree = subtree.#subtrees.get(p);
      if (!subtree) {
        // No bindings match the given key. `result` is already empty; nothing
        // more to do.
        return;
      }
    }

    for (const [k, v] of subtree.#iteratorAt(path)) {
      result.add(k, v);
    }
  }

  /**
   * Underlying implementation of `TreeMap.entries()`, see which for
   * detailed docs.
   *
   * @returns {object} Iterator over the entries of this instance.
   */
  entries() {
    return this.#iteratorAt([]);
  }

  /**
   * Underlying implementation of `TreeMap.find()`, see which for detailed
   * docs.
   *
   * @param {TypePathKey} key Key to search for.
   * @returns {?{key: PathKey, keyRemainder: PathKey, value: *}} The
   *   most specific match, or `null` if there was no match at all.
   */
  find(key) {
    return this.findWithFallback(key).next().value ?? null;
  }

  /**
   * Underlying implementation of `TreeMap.findWithFallback()`, see which
   * for detailed docs.
   *
   * @param {TypePathKey} keyToFind Key to search for.
   * @yields {{key: PathKey, keyRemainder: PathKey, value: *}} One
   *   result.
   */
  *findWithFallback(keyToFind) {
    const { path, wildcard } = keyToFind;

    if (!(keyToFind instanceof PathKey)) {
      PathKey.checkArguments(path, wildcard);
    }

    // In order to find the most-specific result, we end up having to find all
    // the intermediate results first. So we build a list of results as a stack,
    // then pop and `yield` them as demanded.

    const results = [];

    const addResult = (key, value, keyRemainder = null) => {
      results.push({ key, keyRemainder, value });
    };

    let subtree = this;
    let at;
    for (at = 0; at < path.length; at++) {
      if (subtree.#wildcardKey) {
        addResult(subtree.#wildcardKey, subtree.#wildcardValue);
      }
      subtree = subtree.#subtrees.get(path[at]);
      if (!subtree) {
        break;
      }
    }

    if (at === path.length) {
      if (subtree.#wildcardKey) {
        // There's a matching wildcard at the end of the path.
        addResult(subtree.#wildcardKey, subtree.#wildcardValue, PathKey.EMPTY);
      }

      if (subtree.#emptyKey && !wildcard) {
        // There's an exact non-wildcard match for the path.
        addResult(subtree.#emptyKey, subtree.#emptyValue, PathKey.EMPTY);
      }
    }

    while (results.length !== 0) {
      const result = results.pop();
      if (result.keyRemainder === null) {
        const foundAt       = result.key.path.length;
        const pathRemainder = Object.freeze(path.slice(foundAt));
        result.keyRemainder = new PathKey(pathRemainder, false);
      }
      yield result;
    }
  }

  /**
   * Underlying implementation of `TreeMap.get()`, see which for detailed
   * docs.
   *
   * @param {TypePathKey} key Key to look up.
   * @param {*} ifNotFound What to return if a binding is not found.
   * @returns {*} The value bound for the given `key`, or `ifNotFound` if there
   *   is no such binding.
   */
  get(key, ifNotFound) {
    const { path, wildcard } = key;

    if (!(key instanceof PathKey)) {
      PathKey.checkArguments(path, wildcard);
    }

    let subtree = this;

    for (const p of path) {
      subtree = subtree.#subtrees.get(p);
      if (!subtree) {
        return ifNotFound;
      }
    }

    if (wildcard) {
      return subtree.#wildcardKey ? subtree.#wildcardValue : ifNotFound;
    } else {
      return subtree.#emptyKey ? subtree.#emptyValue : ifNotFound;
    }
  }

  /**
   * Underlying implementation of `TreeMap.has()`, see which for detailed
   * docs.
   *
   * @param {TypePathKey} key Key to look up.
   * @returns {boolean} `true` if this instance has a binding for `key`, or
   *   `false` if not.
   */
  has(key) {
    // Slightly cheeky: In order (a) to tell if `null` is found but (b) not have
    // to construct a special `ifNotFound` object, we just use this instance
    // itself as the `ifNotFound` object, because due to the nature of this
    // class it can never appear as a bound value.
    return this.get(key, this) !== this;
  }

  /**
   * Helper for the iteration methods: Returns a generator which iterates over
   * all bindings of this instance, yielding entries where the `path` part of
   * the key is prepended with the given `path` value.
   *
   * @param {Array<string>} pathPrefix Path to prepend to the `path` part of the
   *   key in all yielded results.
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
