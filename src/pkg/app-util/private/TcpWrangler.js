// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ProtocolWrangler } from '#x/ProtocolWrangler';

import * as net from 'node:net';


/**
 * Wrangler for all TCP-based protocols (which is, as of this writing, all of
 * them... but HTTP3 will be here before we know it!).
 */
export class TcpWrangler extends ProtocolWrangler {
  /** @type {object} Server socket creation options. */
  #createOptions;

  /** @type {object} Server socket `listen()` options. */
  #listenOptions;

  /** @type {object} Loggable info, minus any "active listening" info. */
  #loggableInfo = {};

  /**
   * Constructs an instance.
   *
   * @param {object} options Standard construction options.
   */
  constructor(options) {
    super(options);

    this.#createOptions =
      TcpWrangler.#trimOptions(options.socket, TcpWrangler.#CREATE_PROTO);
    this.#listenOptions =
      TcpWrangler.#trimOptions(options.socket, TcpWrangler.#LISTEN_PROTO);
    this.#loggableInfo = {
      interface: this.#listenOptions.host,
      port:      this.#listenOptions.port,
      protocol:  this.protocolName
    };

    if (this.#listenOptions.host === '*') {
      this.#listenOptions.host = '::';
      this.#loggableInfo.interface = '<any>';
    }
  }

  /** @override */
  _impl_createServerSocket() {
    return net.createServer(this.#createOptions);
  }

  /** @override */
  _impl_listen(serverSocket) {
    serverSocket.listen(this.#listenOptions);
  }

  /** @override */
  _impl_loggableInfo() {
    const address = this.serverSocket?.address();
    const info    = { ...this.#loggableInfo };

    if (address) {
      const ip = /:/.test(address.address)
        ? `[${address.address}]` // More pleasant presentation for IPv6.
        : address.address;
      info.listening = `${ip}:${address.port}`;
    }

    return info;
  }


  //
  // Static members
  //

  /** {object} "Prototype" of server socket creation options. */
  static #CREATE_PROTO = Object.freeze({
    allowHalfOpen:         null,
    keepAlive:             null,
    keepAliveInitialDelay: null,
    noDelay:               null,
    pauseOnConnect:        null
  });

  /** {object} "Prototype" of server listen options. */
  static #LISTEN_PROTO = Object.freeze({
    port:      null,
    host:      null,
    backlog:   null,
    exclusive: null
  });

  /**
   * Trims down `options` using the given prototype.
   *
   * @param {object} options Original options.
   * @param {object} proto The "prototype" for what bindings to keep.
   * @returns {object} Pared down version.
   */
  static #trimOptions(options, proto) {
    if (!options) {
      return {};
    }

    const result = {};

    for (const name in proto) {
      if (Object.hasOwn(options, name)) {
        result[name] = options[name];
      }
    }

    return result;
  }
}
