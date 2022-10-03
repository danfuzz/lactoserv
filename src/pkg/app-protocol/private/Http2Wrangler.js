// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TcpWrangler } from '#p/TcpWrangler';

import { Condition, Threadoid } from '@this/async';

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

  /** @type {Condition} Are there currently any sessions? */
  #anySessions = new Condition();

  /** @type {Set} Set of all currently-known sessions. */
  #sessions = new Set();

  /** @type {Threadoid} Thread which runs the high-level stack. */
  #runner = new Threadoid(() => this.#run());

  /**
   * Constructs an instance.
   *
   * @param {object} options Construction options, per the base class spec.
   */
  constructor(options) {
    super(options);

    // Express needs to be wrapped in order for it to use HTTP2.
    this.#application    = http2ExpressBridge(express);
    this.#protocolServer = http2.createSecureServer(options.hosts);

    this.#protocolServer
      .on('request', (req, res) => this.#handleRequest(req, res))
      .on('session', session => this.#addSession(session));
  }

  /** @override */
  _impl_application() {
    return this.#application;
  }

  /** @override */
  async _impl_applicationStart() {
    this.#runner.run();
  }

  /** @override */
  async _impl_applicationStop() {
    return this.#runner.stop();
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
    if (this.#runner.shouldStop()) {
      // Immediately close a session that managed to slip in while we're trying
      // to stop.
      session.close();
      return;
    }

    this.#sessions.add(session);
    this.#anySessions.value = true;

    const removeSession = () => {
      const sessions = this.#sessions;
      sessions.delete(session);
      if (sessions.size === 0) {
        this.#anySessions.value = false;
      }
    };

    session.on('close',      removeSession);
    session.on('error',      removeSession);
    session.on('frameError', removeSession);
    session.on('goaway',     removeSession);
  }

  /**
   * Handles an incoming HTTP(ish) request.
   *
   * @param {http2.Http2ServerRequest} req The incoming request.
   * @param {http2.Http2ServerResponse} res Object to call on to create the
   *   response.
   */
  #handleRequest(req, res) {
    // Express likes to set status messages, but HTTP2 doesn't actually have
    // those. Node helpfully warns about that, but in practice this is just an
    // artifact of Express wanting to not-rely on Node to get default status
    // messages right. So, it's reasonable to squelch the problem with this
    // somewhat grotty patch to the response object.
    Object.defineProperty(res, 'statusMessage', {
      get: () => '',
      set: () => { /* Ignore it. */ }
    });

    this.#application(req, res);
  }

  /**
   * Runs the high-level stack.
   */
  async #run() {
    // As things stand, there isn't actually anything to do other than wait for
    // the stop request and then shut things down.
    await this.#runner.whenStopRequested();

    this.#protocolServer.close();

    // Node docs indicate one has to explicitly close all HTTP2 sessions.
    for (const s of this.#sessions) {
      if (!s.closed) {
        s.close();
      }
    }

    await this.#anySessions.whenFalse();
  }
}
