// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';

import * as util from 'node:util';

/**
 * Map from paths or partial paths to arbitrary bindings. A "path" in this case
 * is a series of zero or more string components, possibly followed by a
 * "wildcard" indicator.
 */
export class TreePathMap {
  /**
   * {Map<string, TreePathMap>} Bindings from each initial path component to a
   * {@link TreePathMap} instance which contains mappings for that component.
   */
  #subtrees = new Map();

  /** {*} Empty-path binding. */
  #emptyValue = null;

  /** {boolean} Is there an empty-path binding? */
  #hasEmpty = false;

  /** {*} Wildcard binding. */
  #wildcardValue = null;

  /** {boolean} Is there a wildcard binding? */
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
   * @param {string[]} path Path to bind.
   * @param {boolean} wildcard Is this a wildcard? That is, should `path` only
   *   be considered for exact matches (`false`), or should it match on prefixes
   *   as well (`true`)?
   * @param {*} value Value to bind at the path.
   * @throws {Error} Thrown if there is already a binding for the given
   *   `{path, wildcard}` combination.
   */
  add(path, wildcard, value) {
    MustBe.arrayOfString(path);
    MustBe.boolean(wildcard);

    this.#add0(path, wildcard, value, 0);
  }

  /**
   * Finds the most-specific binding for the given path.
   *
   * @param {string[]} path Path to look up.
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
  find(path) {
    let subtree = this;
    let foundIndex = -1;
    let result = {
      path: null,
      pathRemainder: null,
      value: null,
      wildcard: true
    };

    let at;
    for (at = 0; at < path.length; at++) {
      if (subtree.#hasWildcard) {
        result.value = subtree.#wildcardValue;
        foundIndex = at;
      }
      subtree = subtree.#subtrees.get(path[at]);
      if (!subtree) {
        break;
      }
    }

    if ((at === path.length) && subtree.#hasEmpty) {
      // There's an exact match for the path.
      result.path = [... path];
      result.pathRemainder = [];
      result.value = subtree.#emptyValue;
      result.wildcard = false;
    } else if (foundIndex >= 0) {
      result.path = path.slice(0, foundIndex);
      result.pathRemainder = path.slice(foundIndex);
    } else {
      result = null;
    }

    return result;
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
    if (pathIndex === (path.length - 1)) {
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
