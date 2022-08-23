// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { HttpWrangler } from '#p/HttpWrangler';
import { Http2Wrangler } from '#p/Http2Wrangler';
import { HttpsWrangler } from '#p/HttpsWrangler';

const wranglerClasses = new Map(Object.entries({
  http:  HttpWrangler,
  http2: Http2Wrangler,
  https: HttpsWrangler
}));

/**
 * Actual Http(s) server.
 */
export class ActualServer {
  /** {object} Configuration object. */
  #config;

  /** {BaseWrangler} Protocol-specific "wrangler." */
  #wrangler;

  /** {HttpServer} `HttpServer`(-like) instance. */
  #server;

  /** {Express} `Express`(-like) application object. */
  #app;

  /** {boolean} Is the server stopped or trying to stop? */
  #stopping = false;

  /** {Promise} Promise that resolves when {@link #stopping} becomes true. */
  #whenStopping;

  /** {function} Function to call in order to resolve {@link #whenStopping}. */
  #resolveWhenStopping;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    this.#config = config;

    const wranglerClass = wranglerClasses.get(config.protocol);

    if (wranglerClass === null) {
      throw new Error('Unknown protocol: ' + config.protocol);
    }

    this.#wrangler = new wranglerClass(this);
    this.#server = this.#wrangler.createServer();
    this.#app = this.#wrangler.createApplication();
    this.#configureApplication();

    this.#whenStopping = new Promise((resolve) => {
      this.#resolveWhenStopping = () => resolve(true);
    });
  }

  /** {express} The Express(-like) application instance. */
  get app() {
    return this.#app;
  }

  /** {object} Configuration object. */
  get config() {
    return this.#config;
  }

  /** {HttpServer} `HttpServer`(-like) instance. */
  get server() {
    return this.#server;
  }

  /** {boolean} Is the server stopped or trying to stop? */
  get stopping() {
    return this.#stopping;
  }

  /**
   * Starts the server.
   */
  async start() {
    if (this.#stopping) {
      throw new Error('Server stopping or already stopped.');
    }

    await this.#wrangler.protocolStart();

    // This `await new Promise` arrangement is done to get the `listen` call to
    // be a good async citizen. Notably, the callback passed to
    // `Server.listen()` cannot (historically) be counted on to get used as an
    // error callback. TODO: Maybe there is a better way to do this these days?
    await new Promise((resolve, reject) => {
      const server = this.#server;

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
      server.on('request',   this.#app);

      const listenOptions = {
        host: this.#config.interface,
        port: this.#config.port
      };

      server.listen(listenOptions);
    });

    const gotPort = this.#server.address().port;

    console.log('Started server.');
    console.log('  protocol:  %s', this.#config.protocol);
    console.log('  listening: interface %s, port %d',
      this.#config.interface, gotPort);
  }

  /**
   * Stops the server. This returns when the server is actually stopped (socket
   * is closed).
   */
  async stop() {
    if (!this.#stopping) {
      await this.#wrangler.protocolStop();
      this.#server.removeListener('request', this.#app);
      this.#server.close();
      this.#stopping = true;
      this.#resolveWhenStopping();
    }

    return this.whenStopped();
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
    if (!this.#stopping) {
      await this.#whenStopping;
    }

    await this.#wrangler.protocolWhenStopped();

    const server = this.#server;

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
   * Configures top-level application settings.
   */
  #configureApplication() {
    const app = this.#app;

    // Means paths `/foo` and `/Foo` are different.
    app.set('case sensitive routing', true);

    // A/O/T `development`. Note: Per Express docs, this makes error messages be
    // "less verbose," so it may be reasonable to turn it off when debugging
    // things like Express routing weirdness etc. Or, maybe this project's needs
    // are so modest that it's better to just leave it in `development` mode
    // permanently.
    app.set('env', 'production');

    // Means paths `/foo` and `/foo/` are different.
    app.set('strict routing', true);

    // Squelches the response header advertisement for Express.
    app.set('x-powered-by', false);
  }
}
