// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfDeconstructable, Sexp } from '@this/sexp';
import { MustBe } from '@this/typey';

import { HostUtil } from '#x/HostUtil';


/**
 * The address of a network interface, consisting of either an IP address and
 * and listening port _or_ a file descriptor (and optional port number).
 * Instances of this class are immutable.
 *
 * @implements {IntfDeconstructable}
 */
export class InterfaceAddress extends IntfDeconstructable {
  /**
   * IP address, host name, or `*` to indicate a wildcard. Will be `null` if
   * {@link #fd} is non-`null`.
   *
   * @type {?string}
   */
  #address;

  /**
   * Port number. May be `null` if {@link #fd} is non-`null`.
   *
   * @type {?number}
   */
  #portNumber;

  /**
   * File descriptor of the address. Will be `null` if {@link #address} is
   * non-`null`.
   *
   * @type {?number}
   */
  #fd;

  /**
   * Result for {@link #toString}, or `null` if not yet calculated.
   *
   * @type {?string}
   */
  #string = null;

  /**
   * Constructs an instance. This accepts _either_ a plain(-like) object with
   * bindings for `{ address, portNumber, fd }` _or_ a string which can be
   * parsed into those as if by {@link HostUtil#parseInterface}.
   *
   * @param {string|object} fullAddress The full address, in one of the forms
   *   mentioned above.
   */
  constructor(fullAddress) {
    super();

    let needCanonicalization;
    if (typeof fullAddress === 'string') {
      fullAddress = HostUtil.parseInterface(fullAddress);
      // `parseInterface()` expects `port` not `portNumber`. TODO: Fix it to be
      // consistent with this class (not the other way around).
      fullAddress.portNumber = fullAddress.port;
      delete fullAddress.port;
      needCanonicalization = false;
    } else {
      needCanonicalization = true;
    }

    const { address: origAddress = null, portNumber = null, fd = null, ...rest } = fullAddress;
    let address = origAddress;

    if (needCanonicalization) {
      if (Object.entries(rest).length !== 0) {
        const extraNames = Object.getOwnPropertyNames(rest).join(', ');
        throw new Error(`Extra properties: ${extraNames}`)
      }

      if ((address === null) && (fd === null)) {
        throw new Error('Must pass one of `address` or `fd`.');
      } else if ((address !== null) && (fd !== null)) {
        throw new Error('Must pass only one of `address` or `fd`.');
      }

      if (address) {
        address = HostUtil.checkInterfaceAddress(address);
        if (portNumber === null) {
          throw new Error('Must pass `portNumber` when using `address`.');
        }
      } else {
        MustBe.number(fd, { safeInteger: true,  minInclusive: 0, maxInclusive: 65535 });
      }

      if (portNumber) {
        // `checkPort()` accepts strings, but we only accept numbers here.
        MustBe.number(portNumber);
        HostUtil.checkPort(portNumber, false);
      }
    }

    this.#address    = address;
    this.#portNumber = portNumber;
    this.#fd         = fd;
  }

  /**
   * @returns {?string} The IP address, hostname, `*` to indicate a wildcard,
   * or `null` if this instance has an {@link #fd}. If an IP address, this is
   * always the canonical form, and _without_ brackets when an IPv6 address.
   */
  get address() {
    return this.#address;
  }

  /**
   * @returns {?number} The file descriptor number, or `null` if this instance
   * has an {@link #address}.
   */
  get fd() {
    return this.#fd;
  }

  /**
   * @returns {?number} The port, or `null` if this instance has an {@link #fd}
   * and no known port.
   */
  get portNumber() {
    return this.#portNumber;
  }

  /** @override */
  deconstruct(forLogging_unused) {
    const { address, fd, portNumber } = this;
    const arg = address ? { address } : { fd };

    if (portNumber) {
      arg.portNumber = portNumber;
    }

    return new Sexp(this.constructor, arg);
  }

  /**
   * Gets a friendly string form of this instance. This is the same form as is
   * accepted in the constructor.
   *
   * @returns {string} The friendly string form.
   */
  toString() {
    if (!this.#string) {
      const { address, fd, portNumber } = this;

      let prefix;
      if (address) {
        prefix = /:/.test(address) ? `[${address}]` : address;
      } else {
        prefix = `/dev/fd/${fd}`;
      }

      this.#string = (portNumber === null)
        ? prefix
        : `${prefix}:${portNumber}`;
    }

    return this.#string;
  }
}
