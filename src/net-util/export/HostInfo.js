// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { AskIf, MustBe } from '@this/typey';


/**
 * Information about a network host, including port number, along with parsing
 * facilities for same.
 */
export class HostInfo {
  /** @type {string} The (fully qualified) name string. */
  #nameString;

  /** @type {number} The port number. */
  #portNumber;

  /** @type {?string} The string form of {@link #portNumber}, if calculated. */
  #portString = null;

  /**
   * @type {?boolean} Is the hostname actually an IP address? `null` if not yet
   * calculated.
   */
  #nameIsIp = null;

  /** @type {?TreePathKey} A path key representing {@link #nameString}. */
  #nameKey = null;

  /**
   * Constructs an instance.
   *
   * **Note:** You are probably better off constructing an instance using one
   * of the static methods on this class.
   *
   * @param {string} nameString The name string.
   * @param {string|number} portNumber The port number, as either a number per
   *   se or a string.
   */
  constructor(nameString, portNumber) {
    this.#nameString = MustBe.string(nameString, /./);
    this.#portNumber = AskIf.string(portNumber)
      ? Number(MustBe.string(portNumber, /^[0-9]+$/))
      : MustBe.number(portNumber);

    MustBe.number(this.#portNumber, {
      safeInteger:  true,
      minInclusive: 0,
      maxInclusive: 65535
    })
  }

  /**
   * @returns {TreePathKey} A path key representing the {@link #nameString},
   * parsed into components. The order of components is back-to-front (reverse
   * order from how it's written). If the hostname is actually a numeric IP
   * address, then the key just has that address as a single-component.
   */
  get nameKey() {
    if (!this.#nameKey) {
      const parts = this.nameIsIpAddress()
        ? [this.#nameString]
        : this.#nameString.split('.').reverse();

      // Freezing `parts` lets `new TreePathKey()` avoid making a copy.
      this.#nameKey = new TreePathKey(Object.freeze(parts), false);
    }

    return this.#nameKey;
  }

  /** @returns {string} The (fully qualified) name string. */
  get nameString() {
    return this.#nameString;
  }

  /** @returns {number} The port number. */
  get portNumber() {
    return this.#portNumber;
  }

  /** @returns {string} The port number, as a string. */
  get portString() {
    if (this.#portString === null) {
      this.#portString = this.#portNumber.toString();
    }

    return this.#portString;
  }

  /**
   * Indicates whether the hostname is actually a numeric IP address.
   *
   * @returns {boolean} `true` iff the hostname is an IP address.
   */
  nameIsIpAddress() {
    if (this.#nameIsIp === null) {
      this.#nameIsIp = /^(\[[:0-9a-fA-F]+\]|[.0-9]+)$/.test(this.#nameString);
    }

    return this.#nameIsIp;
  }


  //
  // Static members
  //

  /**
   * Gets an instance of this class representing `localhost` with the given
   * protocol.
   *
   * @param {string} protocol The network protocol used.
   * @returns {HostInfo} The constructed instance.
   */
  static localhostInstance(protocol) {
    return this.parseHostHeader('localhost', protocol);
  }

  /**
   * Constructs an instance of this class by parsing a string in the format
   * used by the `Host` header of an HTTP(ish) request. The incoming protocol
   * is also required, so as to be able to figure out the port number if not
   * included in the string.
   *
   * @param {string} hostString The `Host` header string to parse.
   * @param {string} protocol The network protocol used.
   * @returns {HostInfo} The parsed info.
   * @throws {Error} Thrown if there was parsing trouble.
   */
  static parseHostHeader(hostString, protocol) {
    MustBe.string(hostString);
    MustBe.string(protocol);

    // After ensuring it contains no ats or slashes (which are definitely not
    // allowed by the URI syntax as part of the hostname per se, and would
    // confuse / mess up our parsing attempt), just let `new URL()` parse the
    // header; it's _probably_ not going to turn out to be an efficiency
    // problem, and it handles a bunch of edge cases too.

    if (/[/@]/.test(hostString)) {
      throw this.#parsingError(hostString);
    }

    const { hostname, port } = new URL(`x://${hostString}`);
    if (port === '') {
      return new HostInfo(hostname, (protocol === 'http') ? 80 : 443);
    } else {
      return new HostInfo(hostname, parseInt(port));
    }
  }

  /**
   * Like {@link #parseHostHeader}, except treats erroneous input as if
   * `localhost` were specified. This method is meant to help implementations
   * provide reasonable responses in the face of bad input (instead of, e.g.,
   * just crashing).
   *
   * @param {string} hostString The `Host` header string to parse.
   * @param {string} protocol The network protocol used.
   * @returns {HostInfo} The parsed info.
   */
  static safeParseHostHeader(hostString, protocol) {
    try {
      return this.parseHostHeader(hostString, protocol);
    } catch (e) {
      return this.localhostInstance(protocol);
    }
  }

  /**
   * Constructs a standard-form parsing error.
   *
   * @param {string} input The input.
   * @returns {Error} The error.
   */
  static #parsingError(input) {
    const error = new TypeError('Invalid URL');

    error.code  = 'ERR_INVALID_URL';
    error.input = input;

    return error;
  }
}
