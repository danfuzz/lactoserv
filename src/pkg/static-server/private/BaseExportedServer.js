// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';
import { PROTECTED_ACCESS } from '#p/PROTECTED_ACCESS';

/**
 * Base class for the exported (public) server classes.
 */
export class BaseExportedServer {
  /** {object} Access token for innards. */
  #accessToken;

  /** {ActualServer} Underlying server instance. */
  #actual;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    this.#actual = new ActualServer(config);
  }

  /**
   * Gets the internal `ActualServer` instance, but only if this method is
   * presented with the designated protected-access token.
   *
   * @param {object} accessToken Access token.
   * @returns {ActualServer} Underlying server instance.
   */
  getActual(accessToken) {
    if (accessToken !== PROTECTED_ACCESS) {
      throw new Error('Access token mismatch.');
    }

    return this.#actual;
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
