// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

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
   * prefixed with a wildcard (`*.example.com`) to represent subdomain
   * wildcards, and complete wildcards (`*`). Name components must be non-empty
   * strings of alphanumerics plus `-`, which furthermore must neither start nor
   * end with a dash.
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
   * Checks that a given value is a string which can be interpreted as an
   * absolute URI path (no protocol, host, etc.). It must:
   *
   * * Start with a slash (`/`).
   * * End with a slash (`/`).
   * * Not contain double (or more) slashes.
   * * Not contain `.` or `..` path components.
   * * Not contain a query or hash fragment.
   * * Not contain characters that need `%`-encoding. (It is expected to be
   *   pre-encoded.)
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkAbsolutePath(value) {
    // Basic constraints.
    const pattern =
      '^' +
      '(?=[/])' +              // Must start with a slash.
      '(?!.*[/][.]{0,2}[/])' + // No empty, `.`, or `..` components.
      '.*/$';                  // Must end with a slash.

    MustBe.string(value, pattern);

    // Check the rest of the constraints by parsing and only accepting it if
    // a successfully-parsed path is the same as the given one.
    try {
      const url = new URL(`http://x${value}`);
      if (url.pathname === value) {
        return value;
      }
    } catch {
      // Fall through.
    }

    throw new Error('Must be an absolute URI path.');
  }

  /**
   * Checks that a given value is a string which can be interpreted as a "basic"
   * absolute URI. It must:
   *
   * * Be a valid URI in general.
   * * Specify either `http` or `https` protocol.
   * * End with a slash (`/`).
   * * Not contain double (or more) slashes.
   * * Not contain `.` or `..` path components.
   * * Not contain a query or hash fragment.
   * * Not contain characters that need `%`-encoding. (It is expected to be
   *   pre-encoded.)
   * * Not contain a username or password.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkBasicUri(value) {
    MustBe.string(value);

    // Check the constraints by parsing as a URL and investigating the result.
    try {
      const url = new URL(value);
      if (   /^https?:$/.test(url.protocol)
          && (url.username === '') && (url.password === '')
          && value.endsWith(url.pathname)
          && !/[/][.]{0,2}[/]/.test(url.pathname) // No invalid path components.
          && /[/]$/.test(url.pathname)) {         // Path ends with a slash.
        return value;
      }
    } catch {
      // Fall through.
    }

    throw new Error('Must be a basic absolute URI.');
  }

  /**
   * Checks that a given value is a string which can be used as a network
   * interface name or address. This allows:
   *
   * * Normal dotted DNS names.
   * * Numeric IPv4 and IPv6 addresses, except _not_ "any" addresses.
   * * The special "name" `*` to represent the "any" address.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkInterface(value) {
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

    // IPv4 address.
    const ipv4Address =
      '(?!0+[.]0+[.]0+[.]0+)' + // No IPv4 "any" addresses.
      '(?!.*[^.]{4})' +         // No more than three digits in a row.
      '(?!.*[3-9][^.]{2})' +    // No 3-digit number over `299`.
      '(?!.*2[6-9][^.])' +      // No `2xx` number over `259`.
      '(?!.*25[6-9])' +         // No `25x` number over `255`.
      '[0-9]{1,3}(?:[.][0-9]{1,3}){3}';

    // IPv6 address.
    const ipv6Address =
      '(?=.*:)' +              // AFAWC, IPv6 requires a colon _somewhere_.
      '(?![:0]+)' +            // No IPv6 "any" addresses.
      '(?!.*[^:]{5})' +        // No more than four digits in a row.
      '(?!(.*::){2})' +        // No more than one `::`.
      '(?!.*:::)' +            // No triple-colons (or quad-, etc.).
      '(?!([^:]*:){8})' +      // No more than seven colons total.
      '(?=.*::|([^:]*:){7}[^:]*$)' + // Contains `::` or exactly seven colons.
      '(?=(::|[^:]))' +        // Must start with `::` or digit.
      '[:0-9A-Fa-f]{2,39}' +   // (Bunch of valid characters.)
      '(?<=(::|[^:]))';        // Must end with `::` or digit.

    const pattern =
      `^(${anyAddress}|${dnsName}|${ipv4Address}|${ipv6Address})$`;

    return MustBe.string(value, pattern);
  }

  /**
   * Checks that a given value is a string in the form of a network mount point
   * (as used by this system). Mount points are URI-ish strings of the form
   * `//<hostname>/<path>/...`, where:
   *
   * * `hostname` is {@link Uris.HOSTNAME_PATTERN_FRAGMENT}.
   * * Each `path` is a non-empty string consisting of alphanumerics plus `-`,
   *   `_`, or `.`; which must furthermore start and end with an alphanumeric
   *   character.
   * * It must start with `//` and end with `/`.
   *
   * **Note:** Mount paths are more restrictive than what is acceptable in
   * general for paths as passed in via HTTP(ish) requests, i.e. an incoming
   * path can legitimately _not_ match a mount path while still being
   * syntactically correct.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkMount(value) {
    const alnum         = 'a-zA-Z0-9';
    const nameComponent = `(?=[${alnum}])[-_.${alnum}]*[${alnum}]`;
    const pattern       =
      `^//${this.HOSTNAME_PATTERN_FRAGMENT}(/${nameComponent})*/$`;

    return MustBe.string(value, pattern);
  }

  /**
   * Checks that a given value is a valid port number, optionally also allowing
   * `*` to specify the wildcard port.
   *
   * @param {*} value Value in question.
   * @param {boolean} allowWildcard Is `*` allowed?
   * @returns {number} `value` if it is a valid port number. If `allowWildcard
   *   === true` and `value === '*'`, then the result is `0`.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkPort(value, allowWildcard) {
    if (typeof value === 'string') {
      if (allowWildcard && (value === '*')) {
        return 0;
      }
      throw new Error('Must be a port number.');
    }

    return MustBe.number(value,
      { safeInteger: true,  minInclusive: 1, maxInclusive: 65535 });
  }

  /**
   * Checks that a given value is a string representing a protocol name (as
   * allowed by this system).
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkProtocol(value) {
    const pattern = /^(http|https|http2)$/;
    return MustBe.string(value, pattern);
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
    MustBe.string(name, this.HOSTNAME_PATTERN);
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
    this.checkMount(mount);

    // Somewhat simplified regexp, because we already know that `mount` is
    // syntactically correct, per `checkMount()` above.
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
