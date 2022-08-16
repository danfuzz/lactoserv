// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

/**
 * Static content server.
 */
export class StaticServer {
  #testPrivate;

  constructor() {
    // TODO!
    console.log('Constructed server.');
    this.#testPrivate = "hello!";
  }

  /**
   * Starts the server.
   */
  start() {
    // TODO!
    console.log('Started server. Hmmm: ' + this.#testPrivate);
  }
}
