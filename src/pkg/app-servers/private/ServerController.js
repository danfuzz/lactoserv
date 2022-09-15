// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationController } from '#p/ApplicationController';
import { WranglerFactory } from '#p/WranglerFactory';

import { Condition } from '@this/async';
import { TreePathKey, TreePathMap } from '@this/collections';

// Types referenced only in doc comments.
import { BaseWrangler } from '#p/BaseWrangler';
import { HostManager } from '#p/HostManager';
import * as express from 'express';
import * as net from 'node:net';

/**
 * "Controller" for a single server. This wraps both a (concrete subclass of a)
 * {@link net.Server} object _and_ an {@link express.Application} which
 * _exclusively_ handles that server.
 */
export class ServerController {
  /** @type {string} Server name. */
  #name;

  /**
   * @type {HostManager} Host manager with bindings for all valid hostnames for
   * this instance.
   */
  #hostManager;

  /**
   * @type {TreePathMap<TreePathMap<ApplicationController>>} Map from hostnames
   * to paths to application controllers. See {@link #makeMountMap} for details.
   */
  #mountMap;

  /** @type {string} Interface address. */
  #interface;

  /** @type {number} Port number. */
  #port;

  /** @type {string} Protocol. */
  #protocol;

  /** @type {BaseWrangler} Protocol-specific "wrangler." */
  #wrangler;

  /** @type {net.Server} Server instance (the direct networking thingy). */
  #server;

  /**
   * @type {express.Application} Application instance which exclusively handles
   * the underlying server of this instance.
   */
  #serverApp;

  /** @type {Condition} Is the server starting or started? */
  #started = new Condition();

  /** @type {Condition} Is the server stopped or trying to stop? */
  #stopping = new Condition();

  /**
   * Constructs an insance.
   *
   * @param {object} serverConfig Server information configuration item. Same
   *   as what's in the exposed config object, except with `app` / `apps`
   *   replaced by `appMounts`, and with `host` / `hosts` replaced by
   *  `hostManager`.
   */
  constructor(serverConfig) {
    this.#name        = serverConfig.name;
    this.#hostManager = serverConfig.hostManager;
    this.#mountMap    = ServerController.#makeMountMap(serverConfig.appMounts);
    this.#interface   = serverConfig.interface;
    this.#port        = serverConfig.port;
    this.#protocol    = serverConfig.protocol;
    this.#wrangler    = WranglerFactory.forProtocol(this.#protocol);
    this.#server      = this.#wrangler.createServer(this.#hostManager);
    this.#serverApp   = this.#wrangler.createApplication();

    this.#configureServerApp();
  }

  /** @returns {string} Server name. */
  get name() {
    return this.#name;
  }

  /**
   * @returns {express.Application} Application instance which exclusively
   * handles the underlying server of this instance.
   */
  get serverApp() {
    return this.#serverApp;
  }

  /**
   * Starts the server.
   */
  async start() {
    if (this.#stopping.value) {
      throw new Error('Server stopping or already stopped.');
    } else if (this.#started.value) {
      // Ignore attempts to start while already started.
      console.log(`Ignoring re-\`start()\` on server ${this.#name}.`);
      return;
    }

    this.#started.value = true;

    const server = this.#server;
    await this.#wrangler.protocolStart(server);

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
      server.on('request',   this.#serverApp);

      server.listen(this.#listenOptions);
    });

    this.#log(`Started server: ${this.name}`);
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

    this.#log(`Stopping server: ${this.name}`);

    await this.#wrangler.protocolStop();

    this.#server.removeListener('request', this.#serverApp);
    this.#server.close();

    this.#stopping.value = true;

    await this.whenStopped();

    this.#log(`Server stopped: ${this.name}`);
  }

  /**
   * Returns when the server becomes stopped (stops listening / closes its
   * server socket). In the case of closing due to an error, this throws the
   * error.
   */
  async whenStopped() {
    await this.#stopping.whenTrue();
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
   * @returns {{host: string, port: number}} Options for doing a `listen()` on a
   * server socket. `host` in the return value corresponds to the network
   * interface.
   */
  get #listenOptions() {
    return {
      host: (this.#interface === '*') ? '::' : this.#interface,
      port: this.#port
    };
  }

  /**
   * @returns {{name: string, interface: string, port: number, protocol:
   * string}} Object with bindings for reasonably-useful logging.
   */
  get #loggableInfo() {
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

    // Do not strip off any parts from the parsed hostname.
    app.set('subdomain offset', 0);

    // Squelches the response header advertisement for Express.
    app.set('x-powered-by', false);

    // Hook up our handler.
    app.use('/', (req, res, next) => { this.#handleRequest(req, res, next); });
  }

  /**
   * Handles a request, as defined by the Express middleware spec.
   *
   * @param {express.Request} req Request object.
   * @param {express.Response} res Response object.
   * @param {function(?object=)} next Function which causes the next-bound
   *   middleware to run.
   */
  #handleRequest(req, res, next) {
    const { path, subdomains } = req;

    // Freezing `subdomains` lets `new TreePathKey()` avoid making a copy.
    const hostKey = new TreePathKey(Object.freeze(subdomains), false);
    const pathKey = ApplicationController.parsePath(path);

    // TODO: Temporary logging to see what's going on.
    console.log('##### request: %s :: %s', hostKey, pathKey);

    // Find the mount map for the most-specific matching host.
    const hostMap = this.#mountMap.find(hostKey)?.value;
    if (!hostMap) {
      // No matching host.
      console.log('##### No host match for: %s', hostKey);
      next();
      return;
    }

    const controller = hostMap.find(pathKey)?.value;
    if (!controller) {
      // No matching path.
      console.log('##### No path match for: %s :: %s', hostKey, pathKey);
      next();
      return;
    }

    // Call the app!
    console.log('##### FOUND APP!');
    controller.app.handleRequest(req, res, next);
  }

  /**
   * Logs a message about the instance, including the protocol, interface, and
   * port.
   *
   * @param {string} msg The topline of the message.
   */
  #log(msg) {
    const info = this.#loggableInfo;

    console.log('%s', msg);
    console.log(`  name:      ${info.name}`);
    console.log(`  protocol:  ${info.protocol}`);
    console.log(`  interface: ${info.interface}`);
    console.log(`  port:      ${info.port}`);

    if (info.listening) {
      console.log(`  listening: ${info.listening}`);
    }
  }


  //
  // Static members.
  //

  /**
   * @returns {string} Regex pattern which matches an interface name or
   * address, anchored so that it matches a complete string.
   *
   * This pattern allows normal dotted DNS names, numeric IPv4 and IPv6 names
   * _except_ not "any" addresses, or the special "name" `*` to represent the
   * "any" address.
   */
  static get INTERFACE_PATTERN() {
    // The one allowed "any" address.
    const anyAddress = '[*]';

    // Normal DNS names. See RFC1035 for details. Notes:
    // * The maximum allowed length for a "label" (name component) is 63.
    // * The maximum allowed total length is 255.
    // * The spec seems to require each label to start with a letter, but in
    //   practice that's commonly violated, e.g. there are many `<digits>.com`
    //   registrations, and `<digits>.<digits>...in-addr.arpa` is commonly used.
    //   So, we instead require labels not start with a dash and that there is
    //   at least one non-digit somewhere in the entire name. This is enough to
    //   disambiguate between a DNS name and an IPv4 address, and to cover
    //   existing uses.
    const dnsLabel = '(?!-)[-a-zA-Z0-9]{1,63}(?<!-)';
    const dnsName  =
      '(?!.{256})' +                    // No more than 255 characters total.
      '(?=.*[a-zA-Z])' +                // At least one letter _somewhere_.
      `${dnsLabel}(?:[.]${dnsLabel})*`; // `.`-delimited sequence of labels.

    // IPv4 address.
    const ipv4Address =
      '(?!0+[.]0+[.]0+[.]0+)' + // No IPv4 "any" addresses.
      '(?!.*[^.]{4})' +         // No more than three digits in a row.
      '(?!.*[3-9][^.]{2})' +    // No 3-digit number over `299`.
      '(?!.*2[6-9][^.])' +      // No `2xx` number over `259`.
      '(?!.*25[6-9])' +         // No `25x` number over `255`.
      '[0-9]{1,3}(?:[.][0-9]{1,3}){3}';

    // IPv6 address.
    const ipv6Address =
      '(?=.*:)' +              // AFAWC, IPv6 requires a colon _somewhere_.
      '(?![:0]+)' +            // No IPv6 "any" addresses.
      '(?!.*[^:]{5})' +        // No more than four digits in a row.
      '(?!(.*::){2})' +        // No more than one `::`.
      '(?!.*:::)' +            // No triple-colons (or quad-, etc.).
      '(?!([^:]*:){8})' +      // No more than seven colons total.
      '(?=.*::|([^:]*:){7}[^:]*$)' + // Contains `::` or exactly seven colons.
      '(?=(::|[^:]))' +        // Must start with `::` or digit.
      '[:0-9A-Fa-f]{2,39}' +   // (Bunch of valid characters.)
      '(?<=(::|[^:]))';        // Must end with `::` or digit.

    return `^(${anyAddress}|${dnsName}|${ipv4Address}|${ipv6Address})$`;
  }

  /**
   * @returns {string} Regex pattern which matches a server name, anchored so
   * that it matches a complete string.
   *
   * This pattern allows non-empty alphanumeric strings that contain dashes, but
   * don't start or end with a dash.
   */
  static get NAME_PATTERN() {
    return '^(?!-)[-a-zA-Z0-9]+(?<!-)$';
  }

  /**
   * Makes the map from each (possibly wildcarded) hostname that this server
   * handles to the map from each (typically wildcarded) path (that is, a path
   * _prefix_ when wildcarded) to the application which handles it.
   *
   * @param {object[]} mounts Mounts, in the form returned from {@link
   *   ApplicationController.makeMountList}
   * @returns {TreePathMap<TreePathMap<ApplicationController>>} The constructed
   *   mount map.
   */
  static #makeMountMap(mounts) {
    const result = new TreePathMap();

    for (const mount of mounts) {
      const { hostname, path, app } = mount;

      let hostMounts = result.findExact(hostname);
      if (!hostMounts) {
        hostMounts = new TreePathMap();
        result.add(hostname, hostMounts);
      }

      hostMounts.add(path, app);
    }

    return result;
  }
}
