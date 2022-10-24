// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';

import { TreePathKey } from '#x/TreePathKey';


/**
 * Map from paths or partial paths to arbitrary bindings. A "path" in this case
 * is a series of zero or more string components, possibly followed by a
 * "wildcard" indicator.
 */
export class TreePathMap {
  /**
   * @type {Map<string, TreePathMap>} Bindings from each initial path component
   * to a {@link TreePathMap} instance which contains mappings for that
   * component.
   */
  #subtrees = new Map();

  /** @type {*} Empty-path binding. */
  #emptyValue = null;

  /** @type {boolean} Is there an empty-path binding? */
  #hasEmpty = false;

  /** @type {*} Wildcard binding. */
  #wildcardValue = null;

  /** @type {boolean} Is there a wildcard binding? */
  #hasWildcard = false;

  /**
   * Constructs an empty instance.
   */
  constructor() {
    // Nothing to do here.
  }

  /**
   * Adds a binding for the given path.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to bind.
   *   If `.wildcard` is `false`, then this method only binds the `.path`. If
   *   `key.wildcard` is `true`, then this method binds all paths with `.path`
   *   as a prefix, including `.path` itself.
   * @param {*} value Value to bind at `key`.
   * @throws {Error} Thrown if there is already a binding for the given `key`.
   */
  add(key, value) {
    if (! (key instanceof TreePathKey)) {
      MustBe.arrayOfString(key.path);
      MustBe.boolean(key.wildcard);
    }

    this.#add0(key, value);
  }

  /**
   * Finds the most-specific binding for the given path.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to look
   *   up. If `.wildcard` is `true`, then this method will only find bindings
   *   which are wildcards, though they might be more general than the `.path`
   *   being looked for.
   * @returns {?{key: TreePathKey, pathRemainder: string[], value: *}}
   *   Information about the found result, or `null` if there was no match at
   *   all.
   *   * `{string[]} path` -- The path that was matched.
   *   * `{string[]} pathRemainder` -- The portion of `path` that was matched by
   *     a wildcard, if this was in fact a wildcard match.
   *   * `{*} value` -- The bound value that was found.
   *   * `{boolean} wildcard` -- Was this a wildcard match?
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
   * Finds the exact given binding. This will only find bindings that were added
   * with the exact same pair of `path` and `wildcard` as are being looked up.
   *
   * @param {TreePathKey|{path: string[], wildcard: boolean}} key Key to look
   *   up.
   * @param {*} [ifNotFound = null] What to return if a binding is not found.
   * @returns {*} The value bound for the given `key`, or `ifNotFound` if there
   *   is no such binding.
   */
  findExact(key, ifNotFound = null) {
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
      return subtree.#hasWildcard ? subtree.#wildcardValue : ifNotFound;
    } else {
      return subtree.#hasEmpty ? subtree.#emptyValue : ifNotFound;
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
      if (subtree.#hasWildcard) {
        throw this.#errorMessage('Path already bound', key);
      }
      subtree.#wildcardValue = value;
      subtree.#hasWildcard = value;
    } else {
      if (subtree.#hasEmpty) {
        throw this.#errorMessage('Path already bound', key);
      }
      subtree.#emptyValue = value;
      subtree.#hasEmpty = value;
    }
  }

  /**
   * Helper for {@link #find}, which does most of the work.
   *
   * @param {string[]} path Path to look up.
   * @param {boolean} wildcard Must the result be a wildcard binding?
   * @returns {?object} Result as described by {@link #find}.
   */
  #find0(path, wildcard) {
    let subtree = this;
    let foundIndex = -1;
    let foundValue = null;

    let at;
    for (at = 0; at < path.length; at++) {
      if (subtree.#hasWildcard) {
        foundValue = subtree.#wildcardValue;
        foundIndex = at;
      }
      subtree = subtree.#subtrees.get(path[at]);
      if (!subtree) {
        break;
      }
    }

    if (at === path.length) {
      if (subtree.#hasEmpty && !wildcard) {
        // There's an exact match for the path.
        return {
          path:          [... path],
          pathRemainder: [],
          value:         subtree.#emptyValue,
          wildcard:      false
        };
      } else if (subtree.#hasWildcard) {
        // There's a matching wildcard at the end of the path.
        return {
          path:          [... path],
          pathRemainder: [],
          value:         subtree.#wildcardValue,
          wildcard:      true
        };
      }
    } else if (foundIndex >= 0) {
      return {
        path:          path.slice(0, foundIndex),
        pathRemainder: path.slice(foundIndex),
        value:         foundValue,
        wildcard:      true
      };
    }

    return null;
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
}
