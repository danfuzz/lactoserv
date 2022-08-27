// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

/**
 * Base class for the exported (public) application classes.
 */
export class BaseApplication {
  /** {function} Middleware function which activates this instance. */
  #middleware;

  /**
   * Constructs an instance.
   */
  constructor() {
    this.#middleware =
      (req, res, next) => this.handleRequest(req, res, next);
  }

  /**
   * "Middleware" handler function which activates this instance by calling
   * through to {@link #handleRequest}.
   */
  get middleware() {
    return this.#middleware;
  }

  /**
   * Handles a request, as defined by the Express middleware spec. Subclasses
   * must override this method.
   *
   * @param {express:Request} req Request object.
   * @param {express:Response} res Response object.
   * @param {Function} next Function which causes the next-bound middleware to
   *   run.
   */
  handleRequest(req, res, next) {
    throw new Error('Abstract method.');
  }
}
