// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { AskIf, MustBe } from '@this/typey';


/**
 * Utilities for parsing various URIs and components thereof.
 */
export class Uris {
  /**
   * @returns {string} Regex pattern which matches a hostname, but _not_
   * anchored to only match a full string.
   */
  static #HOSTNAME_PATTERN_FRAGMENT = (() => {
    const simpleName = '(?!-)[-a-zA-Z0-9]{1,63}(?<!-)';
    const nameOrWild = `(?:[*]|${simpleName})`;

    return '(?![-.a-zA-Z0-9]{256})' +            // No more than 255 characters.
      `(?:${nameOrWild}(?:[.]${simpleName})*)`;  // List of components.
  })();

  /**
   * @returns {string} Regex pattern which matches a hostname, anchored so that
   * it matches a complete string.
   *
   * This pattern allows regular dotted names (`foo.example.com`), regular names
   * prefixed with a wildcard (`*.example.com`) to represent subdomain
   * wildcards, and complete wildcards (`*`). Name components must be non-empty
   * strings of up to 63 characters, consisting of only alphanumerics plus `-`,
   * which furthermore must neither start nor end with a dash. The entire
   * hostname must be no more than 255 characters.
   */
  static #HOSTNAME_PATTERN = `^${this.#HOSTNAME_PATTERN_FRAGMENT}$`;

  /**
   * @returns {string} Regex pattern which matches an IP address (v4 or v6), but
   * _not_ anchored so that it matches a complete string.
   */
  static #IP_ADDRESS_PATTERN_FRAGMENT = (() => {
    // IPv4 address.
    const ipv4Address =
      '(?!0+[.]0+[.]0+[.]0+)' + // No IPv4 "any" addresses.
      '(?!.*[^.]{4})' +         // No more than three digits in a row.
      '(?!.*[3-9][^.]{2})' +    // No 3-digit number over `299`.
      '(?!.*2[6-9][^.])' +      // No `2xx` number over `259`.
      '(?!.*25[6-9])' +         // No `25x` number over `255`.
      '[0-9]{1,3}(?:[.][0-9]{1,3}){3}';

    // IPv6 address (without brackets).
    const ipv6Address =
      '(?=.*:)' +              // IPv6 addresses require a colon _somewhere_.
      '(?=.*[1-9A-Fa-f])' +    // No "any" (at least one non-zero digit).
      '(?!.*[0-9A-Fa-f]{5})' + // No more than four digits in a row.
      '(?!(.*::){2})' +        // No more than one `::`.
      '(?!.*:::)' +            // No triple-colons (or quad-, etc.).
      '(?!([^:]*:){8})' +      // No more than seven colons total.
      '(?=.*::|([^:]*:){7}[^:]*$)' + // Contains `::` or exactly seven colons.
      '(?=(::|[^:]))' +        // Must start with `::` or digit.
      '[:0-9A-Fa-f]{2,39}' +   // (Bunch of valid characters.)
      '(?<=(::|[^:]))';        // Must end with `::` or digit.

    return `(?:${ipv4Address}|${ipv6Address}|\\[${ipv6Address}\\])`;
  })();

  /**
   * @returns {string} Regex pattern which matches an IP address (v4 or v6),
   * anchored so that it matches a complete string.
   *
   * This pattern allows but does not requires IPv6 addresses to be enclosed in
   * square brackets. This pattern does _not_ allow "any" addresses (i.e.,
   * `0.0.0.0` and `::`).
   */
  static #IP_ADDRESS_PATTERN = `^${this.#IP_ADDRESS_PATTERN_FRAGMENT}$`;

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
    // Basic constraints.
    const pattern =
      '^' +
      '(http|https):' +        // Only `http` or `https` protocol.
      '[/][/](?![/])' +        // Exactly two slashes after the colon.
      '(?!.*[/][.]{0,2}[/])' + // No empty, `.`, or `..` components.
      '.*/$';                  // Must end with a slash.

    MustBe.string(value, pattern);

    // Check the rest of the constraints by parsing as a URL and investigating
    // the result.
    try {
      const url = new URL(value);
      if (   (url.username === '') && (url.password === '')
          && value.endsWith(url.pathname)) {
        return value;
      }
    } catch {
      // Fall through to throw the error.
    }

    throw new Error('Must be a basic absolute URI.');
  }

  /**
   * Checks that a given string can be used as a hostname.
   *
   * @param {string} name Hostname to parse.
   * @param {boolean} [allowWildcard] Is a wildcard form allowed for
   *   `name`?
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkHostname(name, allowWildcard = false) {
    MustBe.string(name, this.#HOSTNAME_PATTERN);

    if ((!allowWildcard) && /[*]/.test(name)) {
      throw new Error(`Must not have a wildcard: ${name}`);
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
   * The return value is the same as the given one, except that brackets are
   * removed from bracket-delimited IPv6 forms.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkInterfaceAddress(value) {
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

    const pattern =
      `^(?:${anyAddress}|${dnsName}|${this.#IP_ADDRESS_PATTERN_FRAGMENT})$`;

    MustBe.string(value, pattern);
    return value.startsWith('[')
      ? value.replace(/\[|\]/g, '')
      : value;
  }

  /**
   * Checks that a given value is a valid IP address, either v4 or v6. See
   * {@link #IP_ADDRESS_PATTERN}. This returns the canonicalized form of the
   * address. Canonicalization includes:
   *
   * * dropping irrelevant zero digits (IPv4 and IPv6).
   * * for IPv6:
   *   * removing square brackets, if present.
   *   * downcasing hex digits.
   *   * including `0` values and `::` in the proper positions.
   *
   * @param {*} value Value in question.
   * @param {boolean} [allowAny] Allow "any" addresses (`0.0.0.0` or `::`)?
   * @returns {string} The canonicalized version of `value`.
   * @throws {Error} Thrown if `value` does not match the pattern for an IP
   *   address.
   */
  static checkIpAddress(value, allowAny = false) {
    MustBe.string(value, this.#IP_ADDRESS_PATTERN);

    const origValue = value;

    function dropBrackets(value) {
      return value.replaceAll(/\[|\]/g, '');
    }

    function dropLeadingZeros(value) {
      return value.replaceAll(/(?<=[.:]|^)0+(?=[0-9])/g, '');
    }

    if (/[.]/.test(value)) {
      // IPv4.
      value = dropLeadingZeros(value);

      if ((!allowAny) && (value === '0.0.0.0')) {
        throw new Error(`"Any" address not allowed: ${origValue}`);
      }

      return value;
    }

    // IPv6.

    // Downcase and drop brackets and leading zeros.
    value = value.toLowerCase();
    value = dropLeadingZeros(dropBrackets(value));

    // Split into parts, and expand `::` (if any).

    const needsExpansion = /::/.test(value);
    const parts = value
      .replace(/::/, ':x:')
      .split(':')
      .filter((part) => part !== '');

    if (needsExpansion) {
      const expandAt = parts.indexOf('x');
      const zeros    = new Array(8 - parts.length + 1).fill('0');
      parts.splice(expandAt, 1, ...zeros);
    }

    // Find the longest run of zeros, for `::` replacement (if appropriate).

    let zerosAt    = -1;
    let zerosCount = 0;
    for (let n = 0; n < 8; n++) {
      if (parts[n] === '0') {
        let endAt = n + 1;
        while ((endAt < 8) && (parts[endAt] === '0')) {
          endAt++;
        }
        if ((endAt - n) > zerosCount) {
          zerosCount = endAt - n;
          zerosAt    = n;
        }
        n = endAt - 1;
      }
    }

    if (zerosAt < 0) {
      return parts.join(':');
    } else {
      // A `::` in a middle part will end up being `:::` after the `join()`,
      // hence the `replace(...)`.
      parts.splice(zerosAt, zerosCount, ':');
      value = parts.join(':').replace(/:::/, '::');

      if ((!allowAny) && (value === '::')) {
        throw new Error(`"Any" address not allowed: ${origValue}`);
      }

      return value;
    }
  }

  /**
   * Checks that a given value is a string in the form of a network mount point
   * (as used by this system). Mount points are URI-ish strings of the form
   * `//<hostname>/<path-component>/.../`, where:
   *
   * * The whole string must start with `//` and end with `/`.
   * * `hostname` matches {@link #HOSTNAME_PATTERN_FRAGMENT}.
   * * Each `path-component` is a non-empty string consisting of alphanumerics
   *   plus `-`, `_`, or `.`.
   * * No path component may be `.` or `..`.
   * * No path component may start or end with a `-`.
   *
   * **Note:** Mount paths are more restrictive than what is acceptable in
   * general for paths as passed in via HTTP-ish requests, i.e. an incoming
   * path can legitimately _not_ match a mount path while still being
   * syntactically correct.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkMount(value) {
    const hostname      = this.#HOSTNAME_PATTERN_FRAGMENT;
    const nameComponent = '(?!-|[.]{1,2}/)[-_.a-zA-Z0-9]+(?<!-)';
    const pattern       = `^//${hostname}(/${nameComponent})*/$`;

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
   * @param {boolean} [allowWildcard] Is a wildcard form allowed for
   *   `name`?
   * @returns {TreePathKey} Parsed key.
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
   * @param {boolean} [allowWildcard] Is a wildcard form allowed for
   *   `name`?
   * @returns {?TreePathKey} Parsed key, or `null` if `name` is invalid.
   */
  static parseHostnameOrNull(name, allowWildcard = false) {
    MustBe.string(name);

    if (!AskIf.string(name, this.#HOSTNAME_PATTERN)) {
      return null;
    }

    const path = name.split('.').reverse();

    if (path[path.length - 1] === '*') {
      if (allowWildcard) {
        path.pop();
        return new TreePathKey(path, true);
      } else {
        return null;
      }
    } else {
      return new TreePathKey(path, false);
    }
  }

  /**
   * Parses a network interface spec into its components. Accepts the two forms
   * `<address>:<port>` or `/dev/fd/<fd-num>`. Returns an object which either
   * binds `address` (to a string) and `port` (to a number), or binds just `fd`
   * (to a number). For the purposes of this method, `fd` values are allowed to
   * be in the range `0` to `65535` (even though many systems are more
   * restrictive).
   *
   * @param {string} iface Interface spec to parse.
   * @returns {object} The parsed form.
   */
  static parseInterface(iface) {
    MustBe.string(iface);

    const match = iface.match(
      /^(?:[/]dev[/]fd[/](?<fd>[0-9]{1,5})|(?<address>.{1,300}):(?<port>[0-9]{1,5}))$/)
      ?.groups;

    if (!match) {
      throw new Error(`Invalid network interface: ${iface}`);
    }

    if (match.fd) {
      const fd = MustBe.number(parseInt(match.fd),
        { safeInteger: true,  minInclusive: 0, maxInclusive: 65535 });
      return { fd };
    }

    const address = this.checkInterfaceAddress(match.address);
    const port    = this.checkPort(match.port);

    if (/^(?!\[).*:.*:/.test(iface)) {
      // If we managed to parse and made it here, then we are necessarily
      // looking at an IPv6 address without brackets.
      throw new Error(`Invalid network interface (missing brackets): ${iface}`);
    }

    return { address, port };
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
