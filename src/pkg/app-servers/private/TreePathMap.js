// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TreePathKey } from '#p/TreePathKey';
import { MustBe } from '@this/typey';

import * as util from 'node:util';

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
    const { path, wildcard } = key;

    if (! (key instanceof TreePathKey)) {
      MustBe.arrayOfString(path);
      MustBe.boolean(wildcard);
    }

    this.#add0(path, wildcard, value, 0);
  }

  /**
   * Adds a binding for the given path.
   *
   * @param {string[]} path Path to bind.
   * @param {boolean} wildcard Is this a wildcard? That is, should `path` only
   *   be considered for exact matches (`false`), or should it match on prefixes
   *   as well (`true`)?
   * @param {*} value Value to bind at the path.
   * @throws {Error} Thrown if there is already a binding for the given
   *   `{path, wildcard}` combination.
   */
  add_old(path, wildcard, value) {
    MustBe.arrayOfString(path);
    MustBe.boolean(wildcard);

    this.#add0(path, wildcard, value, 0);
  }

  /**
   * Finds the most-specific binding for the given path.
   *
   * @param {string[]} path Path to look up.
   * @param {boolean} [wildcard = false] Must the result be a wildcard binding?
   * @returns {?{path: string[], pathRemainder: string[], value: *,
   *   wildcard: boolean}} Information about the found result, or `null` if
   *   there was no match at all.
   *   * `path` -- The path that was explicitly matched. This is guaranteed to
   *     be a different instance than the `path` that was passed.
   *   * `pathRemainder` -- The portion of `path` that was matched by the
   *     wildcard, if this was a wildcard match.
   *   * `value` -- The bound value that was found.
   *   * `wildcard` -- Was this a wildcard match?
   */
  find(path, wildcard = false) {
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
   * Finds the exact given binding.
   *
   * @param {string[]} path The path to find.
   * @param {boolean} wildcard Whether to find a wildcard path (`true`) or not
   *   (`false`).
   * @param {*} [ifNotFound = null] What to return if the binding is not found.
   * @returns {*} The value bound for the given `{path, wildcard}` pair, or
   *   `ifNotFound` if there is no such binding.
   */
  findExact(path, wildcard, ifNotFound = null) {
    let subtree = this;

    for (const p of path) {
      subtree = subtree.#subtrees.get(p);
      if (!subtree) {
        return ifNotFound;
      }
    }

    if (wildcard) {
      return subtree.#hasWildcard ? subtree.#wildcardValue : ifNotFound;
    } else {
      return subtree.#hasEmpty ? subtree.#emptyValue : ifNotFound;
    }
  }

  /**
   * Helper for {@link #add}, which does most of the work, including
   * recursive steps, while still allowing for error messages that refer to the
   * original public call.
   *
   * @param {string[]} path Path to bind.
   * @param {boolean} wildcard Is `path` a wildcard?
   * @param {*} value Value to bind at the path.
   * @param {number} pathIndex Index into the path currently being worked on.
   * @throws {Error} Thrown if there is already a binding for the given
   *   `{path, wildcard}` combination.
   */
  #add0(path, wildcard, value, pathIndex) {
    if (pathIndex === path.length) {
      // Base case: Store directly in this instance.
      if (wildcard) {
        if (this.#hasWildcard) {
          throw this.#errorMessage('Path already bound', path, wildcard);
        }
        this.#wildcardValue = value;
        this.#hasWildcard = value;
      } else {
        if (this.#hasEmpty) {
          throw this.#errorMessage('Path already bound', path, wildcard);
        }
        this.#emptyValue = value;
        this.#hasEmpty = value;
      }
    } else {
      // Recursive case: Find or create a subtree, and operate on it.
      const pathItem = path[pathIndex];
      let subtree = this.#subtrees.get(pathItem);
      if (!subtree) {
        subtree = new TreePathMap();
        this.#subtrees.set(pathItem, subtree);
      }
      subtree.#add0(path, wildcard, value, pathIndex + 1);
    }
  }

  /**
   * Returns a composed error message, suitable for `throw`ing.
   *
   * @param {string} msg Basic message.
   * @param {string[]} path Path in question.
   * @param {boolean} wildcard Is `path` a wildcard?
   * @returns {string} The composed error message.
   */
  #errorMessage(msg, path, wildcard) {
    const pathStrings = path.map(s => util.format('%o', s));
    if (wildcard) {
      pathStrings.push('*');
    }

    return `${msg}: [${pathStrings.join(', ')}]`;
  }
}
