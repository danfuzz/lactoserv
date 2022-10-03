// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { WriteSpy } from '@this/app-util';


/**
 * Per-server handler of socket connections. Mostly used for logging.
 */
export class ConnectionHandler {
  /** @type {function(...*)} Underlying logger instance to use. */
  #logger;

  /** @type {Map<socket,object>} Map from each socket to its salient info. */
  #sockets = new Map();


  /**
   * Constructs an instance.
   *
   * @param {function(...*)} logger Underlying logger instance to use.
   */
  constructor(logger) {
    this.#logger = logger;
  }

  /**
   * Informs this instance of a new connection.
   *
   * @param {object} socket Socket which just got connected.
   */
  handleConnection(socket) {
    const logger = this.#logger.$newId;
    const spy    = new WriteSpy(socket, logger);

    this.#sockets.set(socket, { logger, spy });

    socket.on('close', () => this.#handleClose(socket));
    socket.on('error', error => this.#handleClose(socket, error));

    logger.connectedFrom(socket.address());
  }

  /**
   * Handles a socket being closed.
   *
   * @param {object} socket The socket in question.
   * @param {?Error} [error = null] The error that caused it to close, if any.
   */
  #handleClose(socket, error = null) {
    const info = this.#sockets.get(socket);

    this.#sockets.delete(socket);

    if (!info) {
      this.#logger.missingSocket(socket);
      return;
    }

    const { logger, spy } = info;

    // TODO: The "spy" will eventually evolve into something that can help with
    // rate limiting. For now, we're just verifying that its count matches what
    // the socket is actually writing.
    logger.totalBytesWritten(spy.bytesWritten, socket.bytesWritten);
    if (error) {
      logger.error(error);
    }
    logger.closed();
  }
}
