// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { WranglerFactory } from '#p/WranglerFactory';

// Types referenced only in doc comments.
import { BaseWrangler } from '#p/BaseWrangler';
import { HostManager } from '#p/HostManager';

/**
 * "Controller" for a single server. This wraps both a (concrete subclass of a)
 * {@link net.Server} object _and_ an {@link express.Application} which
 * _exclusively_ handles that server.
 */
export class ServerController {
  /** {string} Server name. */
  #name;

  /** {string} Interface address. */
  #interface;

  /** {int} Port number. */
  #port;

  /** {string} Protocol. */
  #protocol;

  /** {BaseWrangler} Protocol-specific "wrangler." */
  #wrangler;

  /** {net.Server} Server instance (the direct networking thingy). */
  #server;

  /**
   * {express.Application} Application instance which exclusively handles the
   * underlying server of this instance.
   */
  #serverApp;

  /**
   * Constructs an insance.
   *
   * @param {object} serverConfig Server information configuration item.
   * @param {HostManager} hostManager Host / certificate manager.
   */
  constructor(serverConfig, hostManager) {
    this.#name      = serverConfig.name;
    this.#interface = serverConfig.interface;
    this.#port      = serverConfig.port;
    this.#protocol  = serverConfig.protocol;
    this.#wrangler  = WranglerFactory.forProtocol(this.#protocol);
    this.#server    = this.#wrangler.createServer(hostManager);
    this.#serverApp = this.#wrangler.createApplication();

    this.#configureServerApp();
  }

  /**
   * @returns {object} Options for doing a `listen()` on a server socket.
   * Includes `host` and `port`, where `host` in this case corresponds to the
   * network interface.
   */
  get listenOptions() {
    return {
      host: (this.#interface === '*') ? '::' : this.#interface,
      port: this.#port
    };
  }

  /** @returns {object} Object with bindings for reasonably-useful logging. */
  get loggableInfo() {
    const address = this.#server.address();
    const info = {
      name:      this.#name,
      interface: (this.#interface === '*') ? '<any>' : this.#interface,
      port:      this.#port,
      protocol:  this.#protocol
    };

    if (address) {
      const ip = /:/.test(address.address)
        ? `[${address.address}]` // More pleasant presentation for IPv6.
        : address.address;
      info.listening = `${ip}:${address.port}`;
    }

    return info;
  }

  /** @returns {string} Server name. */
  get name() {
    return this.#name;
  }

  /** @returns {net.Server} Server instance (the direct networking thingy). */
  get server() {
    return this.#server;
  }

  /**
   * @returns {express.Application} Application instance which exclusively
   * handles the underlying server of this instance.
   */
  get serverApp() {
    return this.#serverApp;
  }

  /** @returns {BaseWrangler} The protocol wrangler. */
  get wrangler() {
    return this.#wrangler;
  }

  /**
   * Configures {@link #serverApp}.
   */
  #configureServerApp() {
    const app = this.#serverApp;

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
