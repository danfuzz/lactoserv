// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfDeconstructable, Sexp } from '@this/sexp';
import { MustBe } from '@this/typey';

import { HostUtil } from '#x/HostUtil';


/**
 * The address of a network endpoint, consisting of an IP address and port.
 * This can be used for either the local or origin (remote) side of a network
 * connection. Instances of this class are immutable.
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
      : HostUtil.checkIpAddress(address);

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
   * Makes a human-friendly network interface specification string. The given
   * object is expected to either bind `address` and `port` (with `port`
   * possibly being `null` but _not_ `undefined`), _or_ bind `fd`.
   *
   * @param {object} iface The interface specification to convert.
   * @returns {string} The friendly form.
   */
  static networkInterfaceString(iface) {
    return (Object.hasOwn(iface, 'fd'))
      ? `/dev/fd/${iface.fd}`
      : this.endpointString(iface.address, iface.port);
  }
}
