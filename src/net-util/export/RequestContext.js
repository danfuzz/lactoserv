// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { EndpointAddress } from '#x/EndpointAddress';
import { InterfaceAddress } from '#x/InterfaceAddress';


/**
 * Information about an HTTP-ish request that is not available through the
 * standard Node `IncomingMessage` class.
 */
export class RequestContext {
  /**
   * The interface that was `listen()`ed on.
   *
   * @type {InterfaceAddress}
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
   * @param {InterfaceAddress} iface The interface that was `listen()`ed on.
   * @param {EndpointAddress} origin Information about the origin (remote side)
   *   of the connection.
   */
  constructor(iface, origin) {
    this.#interface = MustBe.instanceOf(iface, InterfaceAddress);
    this.#origin    = MustBe.instanceOf(origin, EndpointAddress);
  }

  /**
   * @returns {InterfaceAddress} The interface that was `listen()`ed on.
   */
  get interface() {
    return this.#interface;
  }

  /**
   * @returns {EndpointAddress} Information about the origin (remote side) of
   * the connection.
   */
  get origin() {
    return this.#origin;
  }
}
