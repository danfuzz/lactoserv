// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
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
   * IP addresses.
   *
   * @param {string} name Hostname to parse.
   * @param {boolean} [allowWildcard] Is a wildcard form allowed for `name`?
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern, canonicalized if it is an IP address.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkHostname(name, allowWildcard = false) {
    // Handle IP address cases.
    const canonicalIp = EndpointAddress.canonicalizeAddressOrNull(name, false);
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
   * Like {@link #checkHostname}, except it returns `null` to indicate a parsing
   * error.
   *
   * @param {string} name Hostname to parse.
   * @param {boolean} [allowWildcard] Is a wildcard form allowed for `name`?
   * @returns {?string} `value` if it is a string which matches the stated
   *   pattern, canonicalized if it is an IP address. Returns `null` to indicate
   *   a parsing error.
   */
  static checkHostnameOrNull(name, allowWildcard = false) {
    // Handle IP address cases.
    const canonicalIp = EndpointAddress.canonicalizeAddressOrNull(name, false);
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
   * Checks that a given value is a string which can be used as a network
   * interface address, and returns a somewhat-canonicalized form. This allows:
   *
   * * Normal dotted DNS names.
   * * Numeric IPv4 and IPv6 addresses, except _not_ "any" addresses. IPv6
   *   addresses are allowed to be enclosed in brackets.
   * * The special "name" `*` to represent the "any" address.
   *
   * The return value is the same as the given one, except that IP addresses are
   * canonicalized (see {@link EndpointAddress#canonicalizeAddress}).
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkInterfaceAddress(value) {
    const canonicalIp = EndpointAddress.canonicalizeAddressOrNull(value, false);
    if (canonicalIp) {
      return canonicalIp;
    }

    // The one allowed "any" address.
    const anyAddress = '[*]';

    // Normal DNS names. See RFC1035 for details. Notes:
    // * The maximum allowed length for a "label" (name component) is 63.
    // * The maximum allowed total length is 255.
    // * The spec seems to require each label to start with a letter, but in
    //   practice that's commonly violated, e.g. there are many `<digits>.com`
    //   registrations, and `<digits>.<digits>...in-addr.arpa` is commonly used.
    //   So, we instead require labels not start with a dash and that there is
    //   at least one non-digit somewhere in the entire name. This is enough to
    //   disambiguate between a DNS name and an IPv4 address, and to cover
    //   existing uses.
    const dnsLabel = '(?!-)[-a-zA-Z0-9]{1,63}(?<!-)';
    const dnsName  =
      '(?!.{256})' +                    // No more than 255 characters total.
      '(?=.*[a-zA-Z])' +                // At least one letter _somewhere_.
      `${dnsLabel}(?:[.]${dnsLabel})*`; // `.`-delimited sequence of labels.

    const pattern = `^(?:${anyAddress}|${dnsName})$`;

    return MustBe.string(value, pattern);
  }

  /**
   * Checks that a given value is a valid non-wildcard port number, optionally
   * also allowing `*` to specify the wildcard port. Accepts both values of type
   * `number` _and_ strings of decimal digits.
   *
   * @param {*} value Value in question.
   * @param {boolean} allowWildcard Is `*` allowed?
   * @returns {number} `value` if it is a valid non-wildcard port number. If
   *  `allowWildcard === true` and `value === '*'`, then the result is `0`.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkPort(value, allowWildcard) {
    if (typeof value === 'string') {
      if (allowWildcard && (value === '*')) {
        return 0;
      } else if (/^[0-9]+$/.test(value)) {
        // Convert to number, and fall through for range check.
        value = parseInt(value);
      } else {
        throw new Error('Must be a port number.');
      }
    }

    return MustBe.number(value,
      { safeInteger: true,  minInclusive: 1, maxInclusive: 65535 });
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
    const result = this.parseHostnameOrNull(name, allowWildcard);

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
  static parseHostnameOrNull(name, allowWildcard = false) {
    MustBe.string(name);

    // Handle IP address cases.
    const canonicalIp = EndpointAddress.canonicalizeAddressOrNull(name, false);
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
