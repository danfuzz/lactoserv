// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { FormatUtils } from '@this/loggy-intf';
import { IntfDeconstructable, Sexp } from '@this/sexp';
import { MustBe } from '@this/typey';

import { HostUtil } from '#x/HostUtil';


/**
 * Information about the origin (remote side) of a network connection. Instances
 * of this class are immutable.
 *
 * **Note:** This class allows the details of instances to be "unknown." This is
 * unusual in practice, though it _can_ happen. Specifically, Node will report
 * unknown `socket.remoteAddress` and `.remotePort` if the socket isn't
 * connected (which in practice means it got disconnected while in the middle of
 * handling a request).
 *
 * @implements {IntfDeconstructable}
 */
export class OriginAddress extends IntfDeconstructable {
  /**
   * IP address. May be `null` to indicate "unknown."
   *
   * @type {?string}
   */
  #address;

  /**
   * Port number. May be `null` to indicate "unknown."
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
   * @param {?number} portNumber Port number, or `null` if unknown. If
   *   non-`null`, must be an integer in the range `1..65535`.
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
   * IPv6 form.
   *
   * @returns {string} The friendly string form.
   */
  toString() {
    if (!this.#string) {
      this.#string = FormatUtils.addressPortString(this.#address, this.#portNumber);
    }

    return this.#string;
  }
}
