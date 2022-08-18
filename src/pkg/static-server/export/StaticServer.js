// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';

/**
 * Static content server.
 */
export class StaticServer {
  /** {ActualServer} Underlying server instance. */
  #actual;

  /**
   * Constructs an instance.
   *
   * @param {object|null} config Configuration object, or `null` to get a
   *   default of listening for HTTP on port 8080.
   */
  constructor(config) {
    this.#actual = new ActualServer(config);
  }

  /**
   * Starts the server.
   */
  async start() {
    await this.#actual.start();
  }

  /**
   * Stops the server.
   */
  async stop() {
    return this.#actual.stop();
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
    return this.#actual.whenStopped();
  }
}
