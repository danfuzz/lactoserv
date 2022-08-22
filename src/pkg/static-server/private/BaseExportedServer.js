// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';

/**
 * Base class for the exported (public) server classes.
 */
export class BaseExportedServer {
  /** {object} Unique object used to grant access to innards. */
  static #ACCESS_TOKEN = Symbol(this.name);

  /** {object} Access token for innards. */
  #accessToken;

  /** {ActualServer} Underlying server instance. */
  #actual;

  /** {object} Unique object used to grant access to innards. */
  static get ACCESS_TOKEN() {
    return this.#ACCESS_TOKEN;
  }

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
   * presented with the designated access token.
   *
   * This arrangement in effect makes this a "protected method" in the usual
   * sense. (More specifically, it's usable by subclasses in this module but not
   * by clients of this module.)
   *
   * @param {object} acccessToken Access token.
   * @returns {ActualServer} Underlying server instance.
   */
  getActual(accessToken) {
    if (accessToken !== BaseExportedServer.#ACCESS_TOKEN) {
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
