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

  /** {HttpServer} `HttpServer`(-like) instance. */
  #server;

  /** {Express} `Express`(-like) application object. */
  #app;

  /**
   * Constructs an instance.
   */
  constructor(config, actual, server, app) {
    this.#actual = actual;
    this.#config = config;
    this.#server = server;
    this.#app = app;
  }

  /** {ActualServer} Controlling instance. */
  get actual() {
    return this.#actual;
  }

  /** {Express} `Express`(-like) application object. */
  get app() {
    return this.#app;
  }

  /** {HttpServer} `HttpServer`(-like) instance. */
  get server() {
    return this.#server;
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
