// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Condition } from '@this/async';

// Types referenced only in doc comments.
import { ServerController } from '#p/ServerController';

/**
 * Actual Http(s) server. TODO: This class should be folded into
 * {@link ServerController}.
 */
export class ActualServer {
  /** {ServerController} Server controller. */
  #serverController;

  /** {Condition} Is the server stopped or trying to stop? */
  #stopping = new Condition();

  /**
   * Constructs an instance.
   *
   * @param {ServerController} serverController Server controller.
   */
  constructor(serverController) {
    this.#serverController = serverController;
  }

  /**
   * Starts the server.
   */
  async start() {
    if (this.#stopping.value) {
      throw new Error('Server stopping or already stopped.');
    }

    const server = this.#serverController.server;
    await this.#serverController.wrangler.protocolStart(server);

    // This `await new Promise` arrangement is done to get the `listen` call to
    // be a good async citizen. Notably, the callback passed to
    // `Server.listen()` cannot (historically) be counted on to get used as an
    // error callback. TODO: Maybe there is a better way to do this these days?
    await new Promise((resolve, reject) => {
      function done(err) {
        server.removeListener('listening', handleListening);
        server.removeListener('error',     handleError);

        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      }

      function handleListening() {
        done(null);
      }

      function handleError(err) {
        done(err);
      }

      server.on('listening', handleListening);
      server.on('error',     handleError);
      server.on('request',   this.#serverController.serverApp);

      server.listen(this.#serverController.listenOptions);
    });

    this.#log('Started server.');
  }

  /**
   * Stops the server. This returns when the server is actually stopped (socket
   * is closed).
   */
  async stop() {
    if (this.#stopping.value) {
      // Already stopping, just wait for the existing procedure to complete.
      await this.whenStopped();
      return;
    }

    this.#log('Stopping server.');

    await this.#serverController.wrangler.protocolStop();

    const server = this.#serverController.server;
    server.removeListener('request', this.#serverController.serverApp);
    server.close();

    this.#stopping.value = true;

    await this.whenStopped();

    this.#log('Server stopped.');
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
    await this.#stopping.whenTrue();
    await this.#serverController.wrangler.protocolWhenStopped();

    const server = this.#serverController.server;

    // If the server is still listening for connections, wait for it to claim
    // to have stopped.
    while (server.listening) {
      await new Promise((resolve, reject) => {
        function done(err) {
          server.removeListener('close', handleClose);
          server.removeListener('error', handleError);

          if (err !== null) {
            reject(err);
          } else {
            resolve();
          }
        }

        function handleClose() {
          done(null);
        }

        function handleError(err) {
          done(err);
        }

        server.on('close', handleClose);
        server.on('error', handleError);
      });
    }
  }

  /**
   * Logs a message about the instance, including the protocol, interface, and
   * port.
   *
   * @param {string} msg The topline of the message.
   */
  #log(msg) {
    const info = this.#serverController.loggableInfo;

    console.log('%s', msg);
    console.log(`  name:      ${info.name}`);
    console.log(`  protocol:  ${info.protocol}`);
    console.log(`  interface: ${info.interface}`);
    console.log(`  port:      ${info.port}`);

    if (info.listening) {
      console.log(`  listening: ${info.listening}`);
    }
  }
}
