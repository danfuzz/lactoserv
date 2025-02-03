// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Server } from 'node:net';

import { IntfDeconstructable, Sexp } from '@this/sexp';
import { AskIf, MustBe } from '@this/typey';

import { EndpointAddress } from '#x/EndpointAddress';


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
   * Extra options to use when interacting with Node's {@link Server} API.
   *
   * @type {object}
   */
  #nodeOptions;

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
   * **Note:** With regards to `nodeServerOptions`, `allowHalfOpen: true` is
   * included by default, even though that isn't Node's default, because it is
   * arguably a better default to have.
   *
   * @param {string|object} fullAddress The full address, in one of the forms
   *   mentioned above.
   * @param {?object} nodeServerOptions Extra options to use when constructing a
   *   Node {@link Server} object or calling `listen()` on one; or `null` not to
   *   have extra options beyond the defaults.
   */
  constructor(fullAddress, nodeServerOptions = null) {
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
        address = InterfaceAddress.canonicalizeAddress(address);
        if (portNumber === null) {
          throw new Error('Must pass `portNumber` when using `address`.');
        }
      } else {
        MustBe.number(fd, { safeInteger: true,  minInclusive: 0, maxInclusive: 65535 });
      }

      if (portNumber) {
        InterfaceAddress.#checkPortNumber(portNumber);
      }
    }

    this.#address     = address;
    this.#portNumber  = portNumber;
    this.#fd          = fd;
    this.#nodeOptions = InterfaceAddress.#fixNodeOptions(nodeServerOptions);
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
   * @returns {object} Plain object with all options that are to be used when
   * constructing a Node {@link Server} object.
   */
  get nodeServerCreateOptions() {
    const opts   = this.#nodeOptions;
    const result = {};

    const keys = [
      'allowHalfOpen', 'keepAlive', 'keepAliveInitialDelay', 'noDelay',
      'pauseOnConnect'];
    for (const k of keys) {
      const v = opts[k];
      if (v !== undefined) {
        result[k] = v;
      }
    }

    return result;
  }

  /**
   * @returns {object} Plain object with all options that are to be used when
   * calling `listen()` on a Node {@link Server} object.
   */
  get nodeServerListenOptions() {
    const opts    = this.#nodeOptions;
    const address = (this.#address === '*') ? '::' : this.#address;
    const result  = address
      ? { address, port: this.#portNumber }
      : { fd: this.#fd };

    const keys = ['backlog', 'exclusive'];
    for (const k of keys) {
      const v = opts[k];
      if (v !== undefined) {
        result[k] = v;
      }
    }

    return result;
  }

  /**
   * @returns {object} Frozen plain object with all extra options that are to be
   * used when configuring a Node {@link Server} object.
   */
  get nodeServerOptions() {
    return this.#nodeOptions;
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
    const args = [address ? { address } : { fd }];

    if (portNumber) {
      args[0].portNumber = portNumber;
    }

    if (!this.#hasDefaultNodeOptions()) {
      args[1] = this.#nodeOptions;
    }

    return new Sexp(this.constructor, ...args);
  }

  /**
   * Indicates whether or not this instance represents the same interface as the
   * given object. This only returns `true` if `other` is also an instance of
   * this class.
   *
   * @param {*} other Object to compare to.
   * @returns {boolean} `true` if `this` and `other` represent the same
   *   interface.
   */
  equals(other) {
    if (!(other instanceof InterfaceAddress)) {
      return false;
    }

    const { address: a1, fd: fd1, portNumber: pn1 } = this;
    const { address: a2, fd: fd2, portNumber: pn2 } = other;

    if (!((a1 === a2) && (fd1 === fd2) && (pn1 === pn2))) {
      return false;
    }

    const ns1   = this.nodeServerOptions;
    const ns2   = other.nodeServerOptions;
    const keys1 = Object.getOwnPropertyNames(ns1);
    const keys2 = Object.getOwnPropertyNames(ns2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (const k of keys1) {
      if (ns1[k] !== ns2[k]) {
        return false;
      }
    }

    return true;
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

  /**
   * Is {@link #nodeOptions} the default value?
   *
   * @returns {boolean} The answer.
   */
  #hasDefaultNodeOptions() {
    return this.#nodeOptions === InterfaceAddress.#DEFAULT_NODE_OPTIONS;
  }


  //
  // Static members
  //

  /**
   * The default value for {@link #nodeOptions}.
   *
   * @type {object}
   */
  static #DEFAULT_NODE_OPTIONS = Object.freeze({ allowHalfOpen: true });

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
   * canonicalized (see {@link EndpointAddress#canonicalizeAddress}).
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static canonicalizeAddress(value) {
    const canonicalIp = EndpointAddress.canonicalizeAddressElseNull(value, false);
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
   * Gets an instance of this class corresponding to `server.address()` on a
   * standard Node `Server` instance.
   *
   * @param {?Server} server Server object to look at, or `null` to just return
   *  `null`.
   * @returns {?InterfaceAddress} Instance of this class representing the
   *   server's interface, or `null` if `server` is not currently listening.
   */
  static fromNodeServerOrNull(server) {
    const nodeAddress = server?.address();

    if (!nodeAddress) {
      return null;
    }

    const { address: origAddress, port: portNumber } = nodeAddress;

    const address = ((origAddress === '::') || (origAddress === '0.0.0.0'))
      ? '*'
      : origAddress;

    return new InterfaceAddress({ address, portNumber });
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
    const port    = portStr ? this.#checkPortNumber(portStr, true) : null;

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

    const address = InterfaceAddress.canonicalizeAddress(addressOrFd.address);

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
   * Checks a port number for validity.
   *
   * @param {number|string} portNumber The port number in question.
   * @param {boolean} [allowString] Parse strings? If `false`, `portNumber` must
   *   be a number per se.
   * @returns {number} `portNumber` if it is valid.
   * @throws {Error} Thrown if `portNumber` is invalid.
   */
  static #checkPortNumber(portNumber, allowString = false) {
    if (allowString && (typeof portNumber === 'string')) {
      if (/^[0-9]{1,5}$/.test(portNumber)) {
        portNumber = parseInt(portNumber, 10);
      }
    }

    if (AskIf.number(portNumber,
      { safeInteger: true,  minInclusive: 1, maxInclusive: 65535 })) {
      return portNumber;
    }

    throw new Error(`Not a port number: ${portNumber}`);
  }

  /**
   * Validates and "Fixes" a `nodeServerOptions` argument.
   *
   * @param {*} nodeServerOptions Argument to fix.
   * @returns {object} The fixed version.
   * @throws {Error} Thrown if there was trouble.
   */
  static #fixNodeOptions(nodeServerOptions) {
    const DEFAULT   = this.#DEFAULT_NODE_OPTIONS;
    const result    = { ...DEFAULT };
    let   isDefault = true;

    for (const [k, v] of Object.entries(nodeServerOptions ?? {})) {
      switch (k) {
        case 'allowHalfOpen':
        case 'exclusive':
        case 'keepAlive':
        case 'noDelay':
        case 'pauseOnConnect': {
          MustBe.boolean(v);
          break;
        }

        case 'backlog': {
          MustBe.number(v, { safeInteger: true, minInclusive: 0 });
          break;
        }

        case 'keepAliveInitialDelay': {
          MustBe.number(v, { minInclusive: 0 });
          break;
        }

        default: {
          throw new Error(`Unrecognized option: ${k}`);
        }
      }

      if (v !== result[k]) {
        if (isDefault) {
          isDefault = false;
        }
        result[k] = v;
      }
    }

    return isDefault ? DEFAULT : Object.freeze(result);
  }
}
