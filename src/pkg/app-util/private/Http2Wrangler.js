// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TcpWrangler } from '#p/TcpWrangler';

import { Condition } from '@this/async';

import express from 'express';
import http2ExpressBridge from 'http2-express-bridge';

import * as http2 from 'node:http2';


/**
 * Wrangler for `Http2SecureServer`.
 */
export class Http2Wrangler extends TcpWrangler {
  /** @type {express} Express-like application. */
  #application;

  /** @type {?http2.Http2Server} High-level protocol server. */
  #protocolServer;

  /** @type {boolean} Is this instance stopped or trying to stop? */
  #stopping = false;

  /** @type {Condition} Has this instance fully stopped? */
  #fullyStopped = new Condition();

  /** @type {Set} Set of all currently-known sessions. */
  #sessions = new Set();

  constructor(options) {
    super(options);

    // Express needs to be wrapped in order for it to use HTTP2.
    this.#application    = http2ExpressBridge(express);
    this.#protocolServer = http2.createSecureServer(options.hosts);

    this.#protocolServer
      .on('request', this.#application)
      .on('session', session => this.#addSession(session));
  }

  /** @override */
  _impl_application() {
    return this.#application;
  }

  /** @override */
  async _impl_applicationStart() {
    // Nothing left!
  }

  /** @override */
  async _impl_applicationStop() {
    this.#stopping = true;

    // Node docs indicate one has to explicitly close all HTTP2 sessions.
    for (const s of this.#sessions) {
      if (!s.closed) {
        s.close();
      }
    }

    if (this.#sessions.size !== 0) {
      await this.#fullyStopped.whenTrue();
    }
  }

  /** @override */
  _impl_newConnection(socket) {
    this.#protocolServer.emit('connection', socket);
  }

  /**
   * Called whenever a new HTTP2 session gets initiated.
   *
   * @param {http2.ServerHttp2Session} session The new session.
   */
  #addSession(session) {
    if (this.#stopping) {
      // Immediately close a session that managed to slip in while we're trying
      // to stop.
      session.close();
      return;
    }

    this.#sessions.add(session);

    const removeSession = () => {
      const sessions = this.#sessions;
      sessions.delete(session);
      if (this.#stopping && (sessions.size === 0)) {
        this.#fullyStopped.value = true;
      }
    };

    session.on('close',      removeSession);
    session.on('error',      removeSession);
    session.on('frameError', removeSession);
    session.on('goaway',     removeSession);
  }
}
