// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { IntfDeconstructable, Sexp } from '@this/sexp';
import { AskIf, MustBe } from '@this/typey';

import { HostUtil } from '#x/HostUtil';


/**
 * Information about a network host, including port number, along with parsing
 * facilities for same.
 *
 * @implements {IntfDeconstructable}
 */
export class HostInfo extends IntfDeconstructable {
  /**
   * The (fully qualified) name string.
   *
   * @type {string}
   */
  #nameString;

  /**
   * The port number.
   *
   * @type {number}
   */
  #portNumber;

  /**
   * The string form of {@link #portNumber}, if calculated.
   *
   * @type {?string}
   */
  #portString = null;

  /**
   * The "name type," or `null` if not yet calculated.
   *
   * @type {?string}
   */
  #nameType = null;

  /**
   * A path key representing {@link #nameString}, or `null` if not yet
   * calculated.
   *
   * @type {?PathKey}
   */
  #nameKey = null;

  /**
   * The combined name-port string, or `null` if not yet calculated.
   *
   * @type {?string}
   */
  #namePortString = null;

  /**
   * Constructs an instance. **Note:** IPv6 addresses must _not_ include square
   * brackets.
   *
   * **Note:** You are probably better off constructing an instance using one of
   * the static methods on this class.
   *
   * @param {string} nameString The name string, which is assumed to be
   *   in canonicalized form.
   * @param {string|number} portNumber The port number, as either a number per
   *   se or a string.
   */
  constructor(nameString, portNumber) {
    super();

    // Note: The regex is a bit lenient, though notably it _does_ at least
    // guarantee that there are no uppercase letters. TODO: Maybe it should be
    // more restrictive?
    this.#nameString = MustBe.string(nameString, /^[-_.:a-z0-9]+$/);

    this.#portNumber = AskIf.string(portNumber, /^0*[0-9]{1,5}$/)
      ? Number(portNumber)
      : MustBe.number(portNumber);

    MustBe.number(this.#portNumber, {
      safeInteger:  true,
      minInclusive: 0,
      maxInclusive: 65535
    });
  }

  /**
   * @returns {PathKey} A path key representing the {@link #nameString},
   * parsed into components. The order of components is back-to-front (reverse
   * order from how it's written). If the hostname is actually a numeric IP
   * address, then the key just has that address as a single-component.
   */
  get nameKey() {
    if (!this.#nameKey) {
      const parts = this.nameIsIpAddress()
        ? [this.#nameString]
        : this.#nameString.split('.').reverse();

      // Freezing `parts` lets `new PathKey()` avoid making a copy.
      this.#nameKey = new PathKey(Object.freeze(parts), false);
    }

    return this.#nameKey;
  }

  /**
   * @returns {string} The (fully qualified) canonicalized name string. In the
   * case of an IPv6 address, this _does not_ include brackets around the
   * result.
   */
  get nameString() {
    return this.#nameString;
  }

  /**
   * @returns {string} The name and port, colon-separated. In the case of an
   * IPv6 address for the name, the result includes square brackets around the
   * address.
   */
  get namePortString() {
    if (!this.#namePortString) {
      const nameString = this.#nameString;
      const portString = this.portString;
      const namePart   = (this.nameType === 'ipv6') ? `[${nameString}]` : nameString;
      this.#namePortString = `${namePart}:${portString}`;
    }

    return this.#namePortString;
  }

  /**
   * @returns {string} The type of the hostname of this instance, one of `dns`
   * (DNS name), `ipv4` (IPv4 address), or `ipv6` (IPv6 address).
   */
  get nameType() {
    if (!this.#nameType) {
      const nameString = this.#nameString;
      if (/:/.test(nameString)) {
        this.#nameType = 'ipv6';
      } else if (/^[.0-9]+$/.test(nameString)) {
        this.#nameType = 'ipv4';
      } else {
        this.#nameType = 'dns';
      }
    }

    return this.#nameType;
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

  /** @override */
  deconstruct(forLogging_unused) {
    return new Sexp(HostInfo, this.#nameString, this.#portNumber);
  }

  /**
   * Indicates whether the given other instance is an instance of this class
   * with the same information.
   *
   * @param {*} other Instance to compare.
   * @returns {boolean} `true` iff this instance is equal to `other`.
   */
  equals(other) {
    return (other instanceof HostInfo)
      && (this.#nameString === other.#nameString)
      && (this.#portNumber === other.#portNumber);
  }

  /**
   * Gets the name-and-port string, colon separated, except without the port if
   * it is equal to the given one. In the case of an IPv6 address for the name,
   * this _does_ include square brackets around the address even when the port
   * is elided.
   *
   * @param {?number} [portToElide] Port to _not_ include in the result.
   * @returns {string} The name-and-port string.
   */
  getNamePortString(portToElide = null) {
    return (this.#portNumber === portToElide)
      ? this.#nameString
      : this.namePortString;
  }

  /**
   * Indicates whether the hostname is actually a numeric IP address.
   *
   * @returns {boolean} `true` iff the hostname is an IP address.
   */
  nameIsIpAddress() {
    return this.nameType !== 'dns';
  }


  //
  // Static members
  //

  /**
   * Gets an instance of this class from a URL or the string form of same,
   * returning `null` if the
   *
   * @param {URL|string} url URL to extract from.
   * @returns {?HostInfo} The extracted instance, or `null` if `url` could not
   *   be parsed.
   */
  static fromUrlElseNull(url) {
    if (!(url instanceof URL)) {
      try {
        url = new URL(url);
      } catch {
        return null;
      }
    }

    const hostname = this.#hostnameFromUrl(url);
    if (hostname === '') {
      return null;
    }

    // Note: The `hostname` of a `URL` instance is always canonicalized
    // (downcased if a name per se, numbers of IP addresses in canonical form,
    // etc.), so there's no need to do anything extra to canonicalize before
    // construction.
    return new HostInfo(hostname, this.#portFromUrl(url));
  }

  /**
   * Gets an instance of this class representing `localhost` with the given
   * protocol.
   *
   * @param {?number} [localPort] Local port being listened on, if known.
   * @returns {HostInfo} The constructed instance.
   */
  static localhostInstance(localPort = null) {
    if (localPort !== null) {
      MustBe.number(localPort);
    } else {
      localPort = 0;
    }

    return new HostInfo('localhost', localPort);
  }

  /**
   * Constructs an instance of this class by parsing a string in the format used
   * by the `Host` header of an HTTP-ish request, that is, a hostname and port
   * number separated by a colon (`:`). The local port number, if provided, is
   * used when there is no explicit port number in `hostString`; if needed and
   * not provided, it is treated as if it is `0`.
   *
   * @param {string} hostString The `Host` header string to parse.
   * @param {?number} [localPort] Local port being listened on, if known.
   * @returns {HostInfo} The parsed info.
   * @throws {Error} Thrown if there was parsing trouble.
   */
  static parseHostHeader(hostString, localPort = null) {
    const result = this.parseHostHeaderElseNull(hostString, localPort);

    if (!result) {
      throw this.#parsingError(hostString);
    }

    return result;
  }

  /**
   * Like {@link #parseHostHeader}, except returns `null` to indicate a bad
   * parse.
   *
   * @param {string} hostString The `Host` header string to parse.
   * @param {?number} [localPort] Local port being listened on, if known.
   * @returns {?HostInfo} The parsed info, or `null` if `hostString` was
   *   syntactically invalid.
   */
  static parseHostHeaderElseNull(hostString, localPort = null) {
    MustBe.string(hostString);

    if (localPort !== null) {
      MustBe.number(localPort);
    } else {
      localPort = 0;
    }

    // Basic top-level parse.
    const topParse =
      hostString.match(/^(?<hostname>\[.{1,39}\]|[^:]{1,256})(?::(?<port>0*[0-9]{1,5}))?$/)?.groups;

    if (!topParse) {
      return null;
    }

    const { hostname, port } = topParse;

    // Refined `hostname` check, along with IP address canonicalization.
    const canonicalHostname = HostUtil.canonicalizeHostnameElseNull(hostname, false);

    if (!canonicalHostname) {
      return null;
    }

    if (!port) {
      return new HostInfo(canonicalHostname, localPort);
    } else {
      const portNumber = parseInt(port);
      if (portNumber > 65535) {
        return null;
      }
      return new HostInfo(canonicalHostname, portNumber);
    }
  }

  /**
   * Like {@link #parseHostHeader}, except treats erroneous input as if
   * `localhost` were specified. This method is meant to help implementations
   * provide reasonable responses in the face of bad input (instead of, e.g.,
   * just crashing).
   *
   * @param {string} hostString The `Host` header string to parse.
   * @param {?number} [localPort] Local port being listened on, if known.
   * @returns {HostInfo} The parsed info.
   */
  static safeParseHostHeader(hostString, localPort = null) {
    return this.parseHostHeaderElseNull(hostString, localPort)
      ?? this.localhostInstance(localPort);
  }

  /**
   * Gets the hostname from a URL, in canonicalized form.
   *
   * @param {URL} url The URL to extract from.
   * @returns {string} The hostname.
   */
  static #hostnameFromUrl(url) {
    const { hostname, protocol } = url;

    // If the `protocol` is one of the usual ones, then the `hostname` comes
    // pre-canonicalized. If not, we have to canonicalize it.
    switch (protocol) {
      case 'http:':
      case 'https:': {
        // Constructed instances aren't supposed to have brackets for IPv6
        // hostnames.
        return (hostname.startsWith('['))
          ? hostname.replaceAll(/\[|\]/g, '')
          : hostname;
      }

      default: {
        return HostUtil.canonicalizeHostnameElseNull(hostname, false) ?? '';
      }
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

  /**
   * Gets the port number from a URL, including using the standard port numbers
   * for the usual protocols when the port number wasn't specified.
   *
   * @param {URL} url The URL to extract from.
   * @returns {number} The port number.
   */
  static #portFromUrl(url) {
    const port = url.port;

    if (port !== '') {
      return Number(port);
    }

    switch (url.protocol) {
      case 'http:':  return 80;
      case 'https:': return 443;
      default:       return 0;
    }
  }
}
