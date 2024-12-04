// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { EndpointAddress } from '#x/EndpointAddress';

/**
 * Information about an HTTP-ish request that is not available through the
 * standard Node `IncomingMessage` class.
 */
export class RequestContext {
  /**
   * Information about the interface that was `listen()`ed on.
   *
   * @type {{ address: ?string, port: ?number, fd: ?number }}
   */
  #interface;

  /**
   * Information about the origin (remote side) of the connection.
   *
   * @type {EndpointAddress}
   */
  #origin;

  /**
   * Constructs an instance.
   *
   * @param {{ address: ?string, port: ?number, fd: ?number }} iface Information
   *   about the interface that was `listen()`ed on. Must be a frozen object
   *   with expected properties.
   * @param {EndpointAddress} origin Information about the origin (remote side) of
   *   the connection.
   */
  constructor(iface, origin) {
    {
      MustBe.object(iface);
      MustBe.frozen(iface);

      const { address = null, fd = null, port = null } = iface;

      if (address !== null) {
        MustBe.string(address);
      }

      if (fd !== null) {
        // The maximum we use here is pretty much way beyond anything sane, that
        // is, it's a very conservative maximum.
        MustBe.number(fd, { safeInteger: true, minInclusive: 0, maxInclusive: 10000 });
      }

      if (port !== null) {
        MustBe.number(port, { safeInteger: true, minInclusive: 0, maxInclusive: 65535 });
      }
    }

    this.#interface = iface;
    this.#origin    = MustBe.instanceOf(origin, EndpointAddress);
  }

  /**
   * @returns {{ address: ?string, port: ?number, fd: ?number }} Information
   * about the interface that was `listen()`ed on. It is always a frozen object.
   */
  get interface() {
    return this.#interface;
  }

  /**
   * @returns {EndpointAddress} Information about the origin (remote side) of the
   * connection.
   */
  get origin() {
    return this.#origin;
  }
}
