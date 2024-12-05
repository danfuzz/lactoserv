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
   * parsed into those as if by {@link #parseInterface} (see which). In the
   * object form:
   *
   * * `address`: A string consisting of an IP address, hostname, or the
   *   wildcard indicator `*`; or `null` (or omitted) if `fd` is being passed.
   * * `fd`: A number indicating a file descriptor which is used as the
   *   interface, or `null` (or omitted) if `address` is being passed. When
   *   non-`null`, it must be an integer in the range `0..65535`.
   * * `portNumber`: A number indicating the local port of the interface, or
   *   `null` (or omitted) to indicate that the port is unknown or irrelevant.
   *   It _must_ be passed when passing `address`; it is optional (and meant to
   *   be informational only) when passing `fd`. When non-`null`, it must be an
   *   integer in the range `1..65535`.
   *
   * @param {string|object} fullAddress The full address, in one of the forms
   *   mentioned above.
   */
  constructor(fullAddress) {
    super();

    let needCanonicalization;
    if (typeof fullAddress === 'string') {
      fullAddress = InterfaceAddress.parseInterface(fullAddress);
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
        throw new Error(`Extra properties: ${extraNames}`);
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


  //
  // Static members
  //

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
    const port    = portStr ? HostUtil.checkPort(portStr, false) : null;

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

    const address = HostUtil.checkInterfaceAddress(addressOrFd.address);

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
}
