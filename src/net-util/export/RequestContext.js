// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Information about an HTTP(ish) request that is not available through the
 * standard Node `IncomingMessage` class.
 */
export class RequestContext {
  /**
   * @type {string} The IP address that was `listen()`ed on in order to receive
   * the request.
   */
  #listenAddress;

  /**
   * @type {number} The port number that was `listen()`ed on in order to
   * receive the request.
   */
  #listenPort;

  /** @type {string} The IP address that is sending the request. */
  #remoteAddress;

  /** @type {number} The port number that is sending the request. */
  #remotePort;

  /**
   * Constructs an instance.
   *
   * @param {string} listenAddress The IP address that was `listen()`ed on in
   *   order to receive the request.
   * @param {number} listenPort The port number that was `listen()`ed on in
   *   order to receive the request.
   * @param {string} remoteAddress The IP address that is sending the request.
   * @param {number} remotePort The port number that is sending the request.
   */
  constructor(listenAddress, listenPort, remoteAddress, remotePort) {
    this.#listenAddress = MustBe.string(listenAddress);
    this.#listenPort    = MustBe.number(listenPort, { safeInteger: true });
    this.#remoteAddress = MustBe.string(remoteAddress);
    this.#remotePort    = MustBe.number(remotePort, { safeInteger: true });
  }

  /**
   * @type {string} The IP address that was `listen()`ed on in order to receive
   * the request.
   */
  get listenAddress() {
    return this.#listenAddress;
  }

  /**
   * @type {number} The port number that was `listen()`ed on in order to
   * receive the request.
   */
  get listenPort() {
    return this.#listenPort;
  }

  /** @type {string} The IP address that is sending the request. */
  get remoteAddress() {
    return this.#remoteAddress;
  }

  /** @type {number} The port number that is sending the request. */
  get remotePort() {
    return this.#remotePort;
  }
}
