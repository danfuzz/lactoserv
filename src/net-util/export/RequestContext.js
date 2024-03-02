// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Information about an HTTP(ish) request that is not available through the
 * standard Node `IncomingMessage` class.
 */
export class RequestContext {
  /**
   * @type {object} Information about the interface that was `listen()`ed on.
   */
  #interface;

  /** @type {object} Information about the remote side of the connection. */
  #remote;

  /**
   * Constructs an instance.
   *
   * @param {object} iface Information about the interface that was `listen()`ed
   *   on. Must be a frozen object with expected properties.
   * @param {object} remote Information about the remote side of the connection.
   *   Must be a frozen object with expected properties.
   */
  constructor(iface, remote) {
    MustBe.object(iface);
    MustBe.object(remote);
    MustBe.frozen(iface);
    MustBe.frozen(remote);

    MustBe.string(iface.address);
    if (iface.fd) {
      MustBe.number(iface.fd);
    }
    if (iface.port) {
      MustBe.number(iface.port);
    }

    MustBe.string(remote.address);
    MustBe.string(remote.port);

    this.#interface = iface;
    this.#remote    = remote;
  }

  /**
   * @type {object} Information about the interface that was `listen()`ed on.
   */
  get interface() {
    return this.#interface;
  }

  /** @type {object} Information about the remote side of the connection. */
  get remote() {
    return this.#remote;
  }
}
