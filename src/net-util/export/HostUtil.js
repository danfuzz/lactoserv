// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { AskIf, MustBe } from '@this/typey';


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
    const canonicalIp = this.checkIpAddressOrNull(name, false);
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
    const canonicalIp = this.checkIpAddressOrNull(name, false);
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
   * canonicalized (see {@link #checkIpAddress}).
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkInterfaceAddress(value) {
    const canonicalIp = this.checkIpAddressOrNull(value, false);
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
   * Checks that a given value is a valid IP address, either v4 or v6. This
   * returns the canonicalized form of the address. Canonicalization includes:
   *
   * * dropping irrelevant zero digits (IPv4 and IPv6).
   * * for IPv6:
   *   * removing square brackets, if present. (These are allowed but not
   *     required.)
   *   * downcasing hex digits.
   *   * including `0` values and `::` in the proper positions.
   *   * representing the IPv4-in-v6 wrapped form as such (and not as a "pure"
   *     v6 address).
   *
   * @param {*} value Value in question.
   * @param {boolean} [allowAny] Allow "any" addresses (`0.0.0.0` or `::`)?
   * @returns {string} The canonicalized version of `value`.
   * @throws {Error} Thrown if `value` does not match the pattern for an IP
   *   address.
   */
  static checkIpAddress(value, allowAny = false) {
    const result = this.checkIpAddressOrNull(value, allowAny);

    if (result) {
      return result;
    }

    const addendum = allowAny ? '' : ' ("any" not allowed)';
    throw new Error(`Not an IP address${addendum}: ${value}`);
  }

  /**
   * Like {@link #checkIpAddress}, execpt returns `null` to indicate a parsing
   * error.
   *
   * @param {*} value Value in question.
   * @param {boolean} [allowAny] Allow "any" addresses (`0.0.0.0` or `::`)?
   * @returns {?string} The canonicalized version of `value`, or `null` if it
   *   could not be parsed.
   * @throws {Error} Thrown if `value` is not a string.
   */
  static checkIpAddressOrNull(value, allowAny = false) {
    MustBe.string(value);

    return this.#canonicalizeAddressV4(value, allowAny)
      ?? this.#canonicalizeAddressV6(value, allowAny);
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
    const canonicalIp = this.checkIpAddressOrNull(name, false);
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

  /**
   * Parses a network interface spec into its components. Accepts the two forms
   * `<address>:<port>` or `/dev/fd/<fd-num>:<port>` (with the port optional in
   * the latter form). Returns an object with bindings for `address` (a string),
   * `port` (a number), and/or `fd` (a number), depending on the input.
   *
   * For the purposes of this method, `fd` values are allowed to be in the range
   * `0` to `65535` (even though many systems are more restrictive).
   *
   * **Note:** The optional `port` associated with an `fd` is meant for logging
   * purposes, e.g. to indicate that a request came in on a particular port.
   * But, due to the nature of a FD not having a generally-discoverable listen
   * port, users of this system might want to provide it more directly.
   *
   * @param {string} iface Interface spec to parse.
   * @returns {{address: ?string, fd: ?number, port: ?number}} The parsed form.
   */
  static parseInterface(iface) {
    MustBe.string(iface);

    const portStr = iface.match(/:(?<port>[0-9]{1,5})$/)?.groups.port ?? null;
    const port    = portStr ? this.checkPort(portStr) : null;

    const addressStr = portStr
      ? iface.match(/^(?<address>.*):[^:]+$/).groups.address
      : iface;

    const addressOrFd = addressStr
      .match(/^(?:(?:[/]dev[/]fd[/](?<fd>[0-9]{1,5}))|(?<address>[^/].*))$/)?.groups;

    if (!addressOrFd) {
      throw new Error(`Invalid network interface: ${iface}`);
    }

    if (addressOrFd.fd) {
      const fd = MustBe.number(parseInt(addressOrFd.fd),
        { safeInteger: true,  minInclusive: 0, maxInclusive: 65535 });
      return (port === null) ? { fd } : { fd, port };
    }

    const address = this.checkInterfaceAddress(addressOrFd.address);

    if (/^(?!\[).*:.*:/.test(iface)) {
      // If we managed to parse and made it here, then we are necessarily
      // looking at an IPv6 address without brackets.
      throw new Error(`Invalid network interface (missing brackets): ${iface}`);
    } else if (port === null) {
      // Must specify port at this point. (It's optional with the FD form).
      throw new Error(`Invalid network interface (missing port): ${iface}`);
    }

    return { address, port };
  }

  /**
   * Canonicalizes an IPv4 address, returning `null` if it turns out not to be a
   * valid address.
   *
   * @param {string} value The address to canonicalize.
   * @param {boolean} allowAny Allow "any" addresses (`0.0.0.0`)?
   * @returns {?string} The canonical form, or `null` if it could not be parsed.
   */
  static #canonicalizeAddressV4(value, allowAny) {
    if (!/^[.0-9]{7,15}$/.test(value)) {
      // It doesn't pass a syntactic "sniff test."
      return null;
    }

    const parts = value.split('.');
    if (parts.length !== 4) {
      return null;
    }

    for (let i = 0; i < 4; i++) {
      const p = parts[i];
      if ((p.length === 0) || (p.length > 3)) {
        return null;
      }
      const num = parseInt(p, 10);
      if (num > 255) {
        return null;
      }
      parts[i] = `${num}`;
    }

    const result = parts.join('.');

    if ((!allowAny) && (result === '0.0.0.0')) {
      return null;
    }

    return result;
  }

  /**
   * Canonicalizes an IPv6 address, returning `null` if it turns out not to be a
   * valid address.
   *
   * @param {string} value The address to canonicalize.
   * @param {boolean} allowAny Allow "any" addresses (`::`)?
   * @returns {?string} The canonical form, or `null` if it could not be parsed.
   */
  static #canonicalizeAddressV6(value, allowAny) {
    if (!/^\[?[:.0-9a-fA-F]{2,50}\]?$/.test(value)) {
      // It doesn't pass a syntactic "sniff test."
      return null;
    }

    if (value.startsWith('[')) {
      if (!value.endsWith(']')) {
        // Mismatched brackets.
        return null;
      }

      // Trim off brackets.
      value = value.slice(1, value.length - 1);
    } else if (value.endsWith(']')) {
      // Mismatched brackets.
      return null;
    }

    value = value.toLowerCase();

    // Replace `::` with a literal `x` in place of the component.
    if (value === '::') {
      // Skip all the hard work for this edge case.
      return allowAny ? '::' : null;
    } else if (value.startsWith('::')) {
      value = `x${value.slice(1)}`;
    } else if (value.endsWith('::')) {
      value = `${value.slice(0, value.length - 1)}x`;
    } else {
      value = value.replace(/::/, ':x:');
    }

    // Split into parts, and validate / canonicalize each.

    const origParts = value.split(':');
    const lastPart  = origParts[origParts.length - 1];

    if (/[.]/.test(lastPart)) {
      // The final part looks like a wrapped IPv4 address. Validate it.
      const v4Part = this.#canonicalizeAddressV4(lastPart);
      if (!v4Part) {
        return null;
      }
      // Add an extra part as both a marker and to keep the part count correct,
      // keeping `::` compression (below) simpler.
      origParts.pop();
      origParts.push('v4', v4Part);
    }

    const parts = [];
    for (const p of origParts) {
      if (p === 'x') {
        const extraPartCount = 9 - origParts.length;
        if (extraPartCount <= 0) {
          return null;
        }
        for (let n = 0; n < extraPartCount; n++) {
          parts.push('0');
        }
      } else if (p === 'v4') {
        parts.push(p, origParts[origParts.length - 1]);
        break;
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(p)) {
          return null;
        }
        parts.push(p.replace(/^0+(?=.)/, '')); // Drop leading zeroes.
      }
    }

    if (parts.length !== 8) {
      // Too few or too many parts.
      return null;
    }

    // This is `true` if the first six parts are indicative of IPv4 wrapping.
    const hasV4Prefix =
      (parts[0] === '0') && (parts[1] === '0') && (parts[2] === '0') &&
      (parts[3] === '0') && (parts[4] === '0') && (parts[5] === 'ffff');

    if (parts[6] === 'v4') {
      if (!hasV4Prefix) {
        // The original input used the IPv4 wrapping syntax for the last parts,
        // but the prefix isn't actually right.
        return null;
      }
      parts[6] = parts[7];
      parts.pop();
    } else if (hasV4Prefix) {
      // This is a wrapped v4 address, but not already in wrapped form. Convert
      // it.
      const hex6     = parseInt(parts[6], 16);
      const hex7     = parseInt(parts[7], 16);
      const byte1    = hex6 >> 8;
      const byte2    = hex6 & 0xff;
      const byte3    = hex7 >> 8;
      const byte4    = hex7 & 0xff;
      const v4String = `${byte1}.${byte2}.${byte3}.${byte4}`;
      parts.pop();
      parts[6] = v4String;
    }

    // Find the longest run of zeros, for `::` replacement (if appropriate).

    let zerosAt    = -1;
    let zerosCount = 0;
    for (let n = 0; n < parts.length; n++) {
      if (parts[n] === '0') {
        let endAt = n + 1;
        while ((endAt < parts.length) && (parts[endAt] === '0')) {
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
    } else if (zerosCount === 8) {
      if (!allowAny) {
        return null;
      }
      return '::';
    } else {
      // A `::` in a middle part will end up being `:::` after the `join()`,
      // hence the `replace(...)`.
      parts.splice(zerosAt, zerosCount, ':');
      return parts.join(':').replace(/:::/, '::');
    }
  }
}
