// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfDeconstructable, Sexp } from '@this/sexp';
import { MustBe } from '@this/typey';

import { HostUtil } from '#x/HostUtil';


/**
 * Information about the origin (remote side) of a network connection. Instances
 * of this class are always frozen.
 *
 * **Note:** This class allows the details of instances to be "unknown." This is
 * unusual in practice, though it _can_ happen. Specifically, it seems that
 * rarely, the underlying Node library will hand us a socket whose remote side
 * is unknown. This originally manifest as the behavior noted in
 * <https://github.com/danfuzz/lactoserv/issues/432>.
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

    Object.freeze(this);
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
}
