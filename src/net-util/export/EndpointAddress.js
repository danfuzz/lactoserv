// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfDeconstructable, Sexp } from '@this/sexp';
import { MustBe } from '@this/typey';


/**
 * The address of a network endpoint, consisting of an IP address and port. This
 * can be used for either the local or origin (remote) side of a network
 * connection. This class only accepts numerical IP addresses, not hostnames.
 * Instances of this class are immutable.
 *
 * **Note:** This class allows the details of instances to be "unknown." This is
 * unusual in practice, though it _can_ happen. Specifically, Node will report
 * unknown `socket.remoteAddress` and `.remotePort` if the socket isn't
 * connected (which in practice means it got disconnected while in the middle of
 * handling a request).
 *
 * @implements {IntfDeconstructable}
 */
export class EndpointAddress extends IntfDeconstructable {
  /**
   * IP address. May be `null` to indicate "unknown."
   *
   * @type {?string}
   */
  #address;

  /**
   * Port number. May be `null` to indicate "unknown" or "irrelevant."
   *
   * @type {?number}
   */
  #portNumber;

  /**
   * Result for {@link #toString}, or `null` if not yet calculated.
   *
   * @type {?string}
   */
  #string = null;

  /**
   * Constructs an instance.
   *
   * @param {?string} address IP address, or `null` if unknown. If non-`null`,
   *   must be a syntactically valid IP address.
   * @param {?number} portNumber Port number, or `null` if unknown or
   *   irrelevant. If non-`null`, must be an integer in the range `1..65535`.
   */
  constructor(address, portNumber) {
    super();

    this.#address = (address === null)
      ? null
      : EndpointAddress.canonicalizeAddress(address);

    this.#portNumber = (portNumber === null)
      ? null
      : MustBe.number(portNumber, { safeInteger: true, minInclusive: 1, maxInclusive: 65535 });
  }

  /**
   * @returns {?string} The IP address, or `null` if unknown.
   */
  get address() {
    return this.#address;
  }

  /**
   * @returns {?number} The port, or `null` if unknown.
   */
  get portNumber() {
    return this.#portNumber;
  }

  /** @override */
  deconstruct(forLogging_unused) {
    return new Sexp(this.constructor, this.#address, this.#portNumber);
  }

  /**
   * Gets a friendly string form of this instance. With known address and port,
   * this is the form `<address>:<port>`, with `<address>` bracketed when in
   * IPv6 form (to make it clear where the port number is). Special cases:
   *
   * * When {@link #address} is `null`, this returns literally `<unknown>` (with
   *   the angle brackets) in place of the address.
   * * When {@link #address} is in the IPv4-in-v6 wrapped form, this returns
   *   just the IPv4 address (without the `::ffff:` prefix).
   * * When {@link #portNumber} is `null`, this does not return either the colon
   *   or any indication of the port.
   *
   * @returns {string} The friendly string form.
   */
  toString() {
    if (!this.#string) {
      this.#string = EndpointAddress.endpointString(this.#address, this.#portNumber);
    }

    return this.#string;
  }


  //
  // Static members
  //

  /**
   * Checks that a given value is a valid IP address, either v4 or v6, and
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
  static canonicalizeAddress(value, allowAny = false) {
    const result = this.canonicalizeAddressOrNull(value, allowAny);

    if (result) {
      return result;
    }

    const addendum = allowAny ? '' : ' ("any" not allowed)';
    throw new Error(`Not an IP address${addendum}: ${value}`);
  }

  /**
   * Like {@link #canonicalizeAddress}, execpt returns `null` to indicate a
   * parsing error.
   *
   * @param {*} value Value in question.
   * @param {boolean} [allowAny] Allow "any" addresses (`0.0.0.0` or `::`)?
   * @returns {?string} The canonicalized version of `value`, or `null` if it
   *   could not be parsed.
   * @throws {Error} Thrown if `value` is not a string.
   */
  static canonicalizeAddressOrNull(value, allowAny = false) {
    MustBe.string(value);

    return this.#canonicalizeAddressV4(value, allowAny)
      ?? this.#canonicalizeAddressV6(value, allowAny);
  }

  /**
   * Makes a human-friendly network address/port string. This is equivalent to
   * calling `new EndpointAddress(address, portNumber).toString()`, except that
   * the arguments aren't validated or canonicalized.
   *
   * @param {?string} address The address, or `null` if unknown.
   * @param {?number} [portNumber] The port numer, or `null` if unknown or
   *   irrelevant.
   * @returns {string} The friendly string form.
   */
  static endpointString(address, portNumber = null) {
    const portStr = (portNumber === null) ? '' : `:${portNumber}`;

    let addressStr;
    if (address === null) {
      // Unknown address.
      addressStr = '<unknown>';
    } else if (/:/.test(address)) {
      // IPv6 form.
      const wrappedV4 = address.match(/(?<=^\[?::ffff:)(?=.+[.])[^:\]]+(?=\]?$)/)?.[0];
      if (wrappedV4) {
        // It's a "wrapped" IPv4 address. Drop the prefix and any brackets.
        addressStr = wrappedV4;
      } else if (address.startsWith('[')) {
        // Already has brackets. Just leave it as-is.
        addressStr = address;
      } else {
        addressStr = `[${address}]`;
      }
    } else {
      // Presumed to be IPv4 form.
      addressStr = address;
    }

    return `${addressStr}${portStr}`;
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
