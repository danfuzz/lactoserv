// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TreePathKey } from '@this/collections';
import { MustBe } from '@this/typey';


/**
 * Utilities for parsing various URIs and components thereof.
 */
export class Uris {
  /**
   * @returns {string} Regex pattern which matches a hostname, anchored so that
   * it matches a complete string.
   *
   * This pattern allows regular dotted names (`foo.example.com`), regular names
   * prefixed with a wildcard (`*.example.com`), and complete wildcards (`*`).
   * Name components must be non-empty strings of alphanumerics plus `-`, which
   * furthermore must not start or end with a dash.
   */
  static get HOSTNAME_PATTERN() {
    return `^${this.HOSTNAME_PATTERN_FRAGMENT}$`;
  }

  /**
   * @returns {string} Regex pattern which matches a hostname, but _not_
   * anchored to only match a full string.
   */
  static get HOSTNAME_PATTERN_FRAGMENT() {
    const simpleName = '(?!-)[-a-zA-Z0-9]+(?<!-)';
    return '(?:' +
          '[*]' +
          '|' +
          `(?:[*][.])?(?:${simpleName}[.])*${simpleName}` +
          ')';
  }

  /**
   * @returns {RegExp} Regular expression that matches {@link
   * #HOSTNAME_PATTERN}.
   */
  static get HOSTNAME_REGEXP() {
    return new RegExp(this.HOSTNAME_PATTERN);
  }

  /**
   * @returns {string} Regex pattern which matches a (URI-ish) mount point,
   * anchored so that it matches a complete string.
   *
   * This pattern allows regular strings of the form `//<hostname>/<path>/...`,
   * where:
   *
   * * `hostname` is {@link Uris.HOSTNAME_PATTERN_FRAGMENT}.
   * * Each `path` is a non-empty string consisting of alphanumerics plus `-`,
   *   `_`, or `.`; which must furthermore start and end with an alphanumeric
   *   character.
   * * It must start with `//` and end with `/`.
   *
   * **Note:** Mount paths are more restrictive than what is acceptable in
   * general for paths, e.g. a path passed in from a network request can
   * legitimately _not_ match a mount path while still being syntactically
   * correct.
   */
  static get MOUNT_PATTERN() {
    const alnum = 'a-zA-Z0-9';
    const nameComponent = `(?=[${alnum}])[-_.${alnum}]*[${alnum}]`;
    const pattern =
      `^//${this.HOSTNAME_PATTERN_FRAGMENT}(/${nameComponent})*/$`;

    return pattern;
  }

  /**
   * @returns {RegExp} Regular expression that matches {@link
   * #MOUNT_PATTERN}.
   */
  static get MOUNT_REGEXP() {
    return new RegExp(this.MOUNT_PATTERN);
  }

  /**
   * Parses a possibly-wildcarded hostname into a {@link TreePathKey}.
   *
   * **Note:** Because hostname hierarchy is from right-to-left (e.g., wildcards
   * are at the front of a hostname not the back), the `.path` of the result
   * contains the name components in back-to-front order.
   *
   * @param {string} name Hostname to parse.
   * @param {boolean} [allowWildcards = false] Is a wildcard form allowed for
   *   `name`?
   * @returns {TreePathKey} Parsed key.
   * @throws {Error} Thrown if `name` is invalid.
   */
  static parseHostname(name, allowWildcards = false) {
    MustBe.string(name, this.HOSTNAME_REGEXP);
    const path = name.split('.').reverse();
    let wildcard = false;

    if (path[path.length - 1] === '*') {
      path.pop();
      wildcard = true;
    }

    if (wildcard && !allowWildcards) {
      throw Error(`Wildcard not allowed for name: ${name}`);
    }

    return new TreePathKey(path, wildcard);
  }

  /**
   * Parses a mount point into its two components.
   *
   * @param {string} mount Mount point.
   * @returns {{hostname: TreePathKey, path: TreePathKey}} Components thereof.
   */
  static parseMount(mount) {
    MustBe.string(mount, this.MOUNT_REGEXP);

    // Somewhat simplified regexp, because we already know that `mount` is
    // syntactically correct, per `MustBe...` above.
    const topParse = /^[/][/](?<hostname>[^/]+)[/](?:(?<path>.*)[/])?$/
      .exec(mount);

    if (!topParse) {
      throw new Error(`Strange mount point: ${mount}`);
    }

    const { hostname, path } = topParse.groups;
    const pathParts = path ? path.split('/') : [];

    // `TreePathKey...true` below because all mounts are effectively wildcards.
    return Object.freeze({
      hostname: Uris.parseHostname(hostname, true),
      path:     new TreePathKey(pathParts, true)
    });
  }
}
