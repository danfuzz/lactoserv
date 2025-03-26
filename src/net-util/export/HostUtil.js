// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { AskIf, MustBe } from '@this/typey';

import { EndpointAddress } from '#x/EndpointAddress';


/**
 * Utilities for dealing with hostnames, IP addresses, and the like. This
 * includes methods for parsing.
 */
export class HostUtil {
  /**
   * @returns {RegExp} Regex which matches a possibly-wildcarded hostname (name
   * per se, not a numeric address), anchored to only match a full string.
   *
   * This pattern allows regular dotted names (`foo.example.com`), regular names
   * prefixed with a wildcard (`*.example.com`) to represent subdomain
   * wildcards, and complete wildcards (`*`). Name components must be non-empty
   * strings of up to 63 characters, consisting of only alphanumerics plus `-`,
   * which furthermore must neither start nor end with a dash. The entire
   * hostname must be no more than 255 characters, and the name must either be a
   * full wildcard (that is, just `*`) _or_ contain an alphabetic character
   * somewhere within it (because otherwise it could wouldn't be a name; it'd be
   * a numeric address).
   */
  static #HOSTNAME_REGEX = (() => {
    const simpleName = '(?!-)[-a-zA-Z0-9]{1,63}(?<!-)';
    const nameOrWild = `(?:[*]|${simpleName})`;

    const body = '(?![-.a-zA-Z0-9]{256})' +   // No more than 255 characters.
      '(?=[*]$|.*[a-zA-Z])' +                 // Just `*`, or alpha _somewhere_.
      `(?:${nameOrWild}(?:[.]${simpleName})*)`;  // List of components.

    return new RegExp(`^${body}$`);
  })();

  /**
   * Checks that a given string can be used as a hostname, including non-"any"
   * IP addresses. Returns the canonicalized version.
   *
   * @param {string} name Hostname to parse.
   * @param {boolean} [allowWildcard] Is a wildcard form allowed for `name`?
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern, canonicalized if it is an IP address.
   * @throws {Error} Thrown if `value` does not match.
   */
  static canonicalizeHostname(name, allowWildcard = false) {
    // Handle IP address cases.
    const canonicalIp = EndpointAddress.canonicalizeAddressElseNull(name, false);
    if (canonicalIp) {
      return canonicalIp;
    }

    MustBe.string(name, this.#HOSTNAME_REGEX);

    if ((!allowWildcard) && /[*]/.test(name)) {
      throw new Error(`Must not have a wildcard: ${name}`);
    }

    return name;
  }

  /**
   * Like {@link #canonicalizeHostname}, except it returns `null` to indicate a
   * parsing error.
   *
   * @param {string} name Hostname to parse.
   * @param {boolean} [allowWildcard] Is a wildcard form allowed for `name`?
   * @returns {?string} `value` if it is a string which matches the stated
   *   pattern, canonicalized if it is an IP address. Returns `null` to indicate
   *   a parsing error.
   */
  static canonicalizeHostnameElseNull(name, allowWildcard = false) {
    // Handle IP address cases.
    const canonicalIp = EndpointAddress.canonicalizeAddressElseNull(name, false);
    if (canonicalIp) {
      return canonicalIp;
    }

    if (!AskIf.string(name, this.#HOSTNAME_REGEX)) {
      return null;
    }

    if ((!allowWildcard) && /[*]/.test(name)) {
      return null;
    }

    return name;
  }

  /**
   * Gets the string form of a {@link PathKey}, interpreted as a hostname, where
   * the TLD is the initial path component. That is, the result renders the key
   * in reverse.
   *
   * @param {PathKey} key The key to convert.
   * @returns {string} The hostname string form.
   */
  static hostnameStringFrom(key) {
    MustBe.instanceOf(key, PathKey);

    return key.toString({
      prefix:    '',
      separator: '.',
      suffix:    '',
      reverse:   true
    });
  }

  /**
   * Parses a possibly-wildcarded hostname into a {@link PathKey}. This accepts
   * both DNS names and IP addresses. In the case of an IP address, the result
   * is a single-component path key.
   *
   * **Note:** Because hostname hierarchy is from right-to-left (e.g., wildcards
   * are at the front of a hostname not the back), the `.path` of the result
   * contains the name components in back-to-front order.
   *
   * @param {string} name Hostname to parse.
   * @param {boolean} [allowWildcard] Is a wildcard form allowed for `name`?
   * @returns {PathKey} Parsed key.
   * @throws {Error} Thrown if `name` is invalid.
   */
  static parseHostname(name, allowWildcard = false) {
    const result = this.parseHostnameElseNull(name, allowWildcard);

    if (result) {
      return result;
    }

    const wildMsg = allowWildcard ? 'allowed' : 'disallowed';
    throw new Error(`Invalid hostname (wildcards ${wildMsg}): ${name}`);
  }

  /**
   * Like {@link #parseHostname}, except returns `null` to indicate an invalid
   * hostname.
   *
   * @param {string} name Hostname to parse.
   * @param {boolean} [allowWildcard] Is a wildcard form allowed for `name`?
   * @returns {?PathKey} Parsed key, or `null` if `name` is invalid.
   */
  static parseHostnameElseNull(name, allowWildcard = false) {
    MustBe.string(name);

    // Handle IP address cases.
    const canonicalIp = EndpointAddress.canonicalizeAddressElseNull(name, false);
    if (canonicalIp) {
      return new PathKey([canonicalIp], false);
    }

    if (!AskIf.string(name, this.#HOSTNAME_REGEX)) {
      return null;
    }

    const path = name.split('.').reverse();

    if (path[path.length - 1] === '*') {
      if (allowWildcard) {
        path.pop();
        return new PathKey(path, true);
      } else {
        return null;
      }
    } else {
      return new PathKey(path, false);
    }
  }
}
