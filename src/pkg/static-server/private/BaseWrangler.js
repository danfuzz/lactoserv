// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

/**
 * Common interface for "wrangling" each of the different server protocols.
 * Concrete instances of this class remain "hidden" behind a public-facing
 * server instance, so as to prevent clients of this package from reaching in
 * and messing with internals.
 */
export class BaseWrangler {
  /** {object} Configuration info. */
  #config;

  /** {ActualServer} Controlling instance. */
  #actual;

  /**
   * Constructs an instance.
   */
  constructor(config, actual) {
    this.#actual = actual;
    this.#config = config;
  }

  /** {ActualServer} Controlling instance. */
  get actual() {
    return this.#actual;
  }

  /**
   * Makes the underlying application instance, i.e. an instance of
   * `express:Express` or thing that is (approximately) compatible with same.
   * This method must be overridden in the subclass.
   */
  createApplication() {
    throw new Error('Abstract method.');
  }

  /**
   * Makes the underlying server instance, i.e. an instance of `node:HttpServer`
   * or thing that is (approximately) compatible with same. This method must be
   * overridden in the subclass.
   */
  createServer() {
    throw new Error('Abstract method.');
  }

  /**
   * Performs protocol-specific actions for {@link #start}. This method must be
   * overridden in the subclass.
   */
  sub_start() {
    throw new Error('Abstract method.');
  }

  /**
   * Performs protocol-specific actions for {@link #stop}. This method must be
   * overridden in the subclass.
   */
  sub_stop() {
    throw new Error('Abstract method.');
  }

  /**
   * Performs protocol-specific actions for {@link #whenStopped}. This method
   * must be overridden in the subclass.
   */
  sub_whenStopped() {
    throw new Error('Abstract method.');
  }
}
