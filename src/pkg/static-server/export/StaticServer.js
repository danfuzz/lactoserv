// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';

/**
 * Static content server.
 */
export class StaticServer {
  #actual;

  constructor() {
    this.#actual = new ActualServer();
  }

  /**
   * Starts the server.
   */
  async start() {
    console.log('### static 1');
    await this.#actual.start();
    console.log('### static 2');
  }
}
