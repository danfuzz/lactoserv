// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MustBe } from '@this/typey';

import { TreePathKey } from '#x/TreePathKey';


/**
 * Node within a {@link TreePathMap}. This class contains practically all of the
 * main tree manipulation and access logic for that class.
 */
export class TreePathNode {
  /**
   * @type {Map<string, TreePathNode>} Bindings from each initial path component
   * to a {@link TreePathNode} which contains mappings for that component.
   */
  #subtrees = new Map();

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

  // Note: The default constructor is fine here.

  /**
   * Underlying implementation of `TreePathMap.add()`, see which for detailed
   * docs. Note the different return-vs-throw behavior compared to the exposed
   * method.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to bind.
   * @param {*} value Value to bind at `key`.
   * @returns {boolean} `true` if the binding was added, or `false` if there was
   *   already a binding for `key`.
   */
  add(key, value) {
    const { path, wildcard } = key;

    if (! (key instanceof TreePathKey)) {
      MustBe.arrayOfString(path);
      MustBe.boolean(wildcard);
    }

    let subtree = this;

    // Add any required subtrees to represent `path`, leaving `subtree` as the
    // instance to modify.
    for (const p of path) {
      let nextSubtree = subtree.#subtrees.get(p);
      if (!nextSubtree) {
        nextSubtree = new TreePathNode();
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
   * Underlying implementation of `TreePathMap.entries()`, see which for
   * detailed docs.
   *
   * @returns {object} Iterator over the entries of this instance.
   */
  entries() {
    return this.#iteratorAt([]);
  }

  /**
   * Underlying implementation of `TreePathMap.find()`, see which for detailed
   * docs.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to look
   *   up.
   * @param {boolean} wantNextChain Should the return value have `next` as
   *   appropriate?
   * @returns {?{key: TreePathKey, keyRemainder: TreePathKey, value: *}} The
   *   found result, or `null` if there was no match.
   */
  find(key, wantNextChain) {
    const { path, wildcard } = key;

    if (! (key instanceof TreePathKey)) {
      MustBe.arrayOfString(path);
      MustBe.boolean(wildcard);
    }

    return this.#find0(path, wildcard, wantNextChain);
  }

  /**
   * Underlying implementation of `TreePathMap.findSubtree()`, see which for
   * detailed docs.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to look
   *   up.
   * @param {function(TreePathKey, *)} add Function to call to add an entry to
   *   the result. This is used instead of constructing a result instance
   *   directly here, so as to avoid a circular dependency on `TreePathMap`.
   */
  findSubtree(key, add) {
    const { path, wildcard } = key;

    if (! (key instanceof TreePathKey)) {
      MustBe.arrayOfString(path);
      MustBe.boolean(wildcard);
    }

    if (!wildcard) {
      // Non-wildcard is easy, because `find()` already does the right thing.
      const found  = this.find(key);
      if (found !== null) {
        add(key, found.value);
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
      add(k, v);
    }
  }

  /**
   * Underlying implementation of `TreePathMap.get()`, see which for detailed
   * docs.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to look
   *   up.
   * @param {*} ifNotFound What to return if a binding is not found.
   * @returns {*} The value bound for the given `key`, or `ifNotFound` if there
   *   is no such binding.
   */
  get(key, ifNotFound) {
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
   * Helper for {@link #find}, which does most of the work.
   *
   * @param {string[]} path Path to look up.
   * @param {boolean} wildcard Must the result be a wildcard binding?
   * @param {boolean} wantNextChain Should the result contain a `next` chain?
   * @returns {?object} Result as described by {@link #find}.
   */
  #find0(path, wildcard, wantNextChain) {
    let subtree = this;
    let result  = null;

    const updateResult = (key, value, keyRemainder = null) => {
      result = (wantNextChain && result)
        ? { key, keyRemainder, value, next: result }
        : { key, keyRemainder, value };
    };

    let at;
    for (at = 0; at < path.length; at++) {
      if (subtree.#wildcardKey) {
        // Placeholder for `keyRemainder`, only calculated if needed.
        updateResult(subtree.#wildcardKey, subtree.#wildcardValue);
      }
      subtree = subtree.#subtrees.get(path[at]);
      if (!subtree) {
        break;
      }
    }

    if (at === path.length) {
      if (subtree.#wildcardKey) {
        // There's a matching wildcard at the end of the path.
        updateResult(subtree.#wildcardKey, subtree.#wildcardValue, TreePathKey.EMPTY);
      }

      if (subtree.#emptyKey && !wildcard) {
        // There's an exact non-wildcard match for the path.
        updateResult(subtree.#emptyKey, subtree.#emptyValue, TreePathKey.EMPTY);
      }
    }

    if (result !== null) {
      // Calculate `keyRemainder` for the result(s), if necessary.
      for (let r = result; r; r = r.next) {
        if (r.keyRemainder === null) {
          const foundAt       = r.key.path.length;
          const pathRemainder = Object.freeze(path.slice(foundAt));
          r.keyRemainder = new TreePathKey(pathRemainder, false);
        }
      }
    }

    return result;
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
