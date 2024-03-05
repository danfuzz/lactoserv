// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Information about an HTTP(ish) request that is not available through the
 * standard Node `IncomingMessage` class.
 */
export class RequestContext {
  /**
   * @type {{ address: ?string, port: ?number, fd: ?number }} Information about
   * the interface that was `listen()`ed on.
   */
  #interface;

  /**
   * @type {{ address: string, port: number }}  Information about the origin
   * (remote side) of the connection.
   */
  #origin;

  /**
   * Constructs an instance.
   *
   * @param {{ address: ?string, port: ?number, fd: ?number }} iface Information
   *   about the interface that was `listen()`ed on. Must be a frozen object
   *   with expected properties.
   * @param {{ address: string, port: number }} origin Information about the
   *   origin (remote side) of the connection. Must be a frozen object with
   *   expected properties.
   */
  constructor(iface, origin) {
    {
      MustBe.object(iface);
      MustBe.frozen(iface);

      const { address, fd, port } = iface;

      if (address !== null) {
        MustBe.string(address);
      }

      if (fd !== null) {
        MustBe.number(fd);
      }

      if (port !== null) {
        MustBe.number(port, { safeInteger: true, minInclusive: 0, maxInclusive: 65535 });
      }
    }

    {
      MustBe.object(origin);
      MustBe.frozen(origin);

      const { address, port } = origin;

      MustBe.string(address);
      MustBe.number(port);
    }

    this.#interface = iface;
    this.#origin    = origin;
  }

  /**
   * @returns {{ address: ?string, port: ?number, fd: ?number }} Information
   * about the interface that was `listen()`ed on. It is always a frozen object.
   */
  get interface() {
    return this.#interface;
  }

  /**
   * @returns {{ address: string, port: number }} Information about the origin
   * (remote side) of the connection. It is always a frozen object.
   */
  get origin() {
    return this.#origin;
  }
}
