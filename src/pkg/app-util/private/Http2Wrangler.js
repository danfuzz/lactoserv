// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TcpWrangler } from '#p/TcpWrangler';

import { Condition } from '@this/async';

import express from 'express';
import http2ExpressBridge from 'http2-express-bridge';

import * as http2 from 'node:http2';
import * as net from 'node:net';

/**
 * Wrangler for `Http2SecureServer`.
 */
export class Http2Wrangler extends TcpWrangler {
  /** @type {?net.Server} Server being wrangled, once known. */
  #server = null;

  /** @type {boolean} Is this instance stopped or trying to stop? */
  #stopping = false;

  /** @type {Condition} Has this instance fully stopped? */
  #fullyStopped = new Condition();

  /** @type {Set} Set of all currently-known sessions. */
  #sessions = new Set();

  // Note: Default constructor suffices.

  /** @override */
  createApplication() {
    // Express needs to be wrapped in order to use HTTP2.
    return http2ExpressBridge(express);
  }

  /** @override */
  createServer(certOptions) {
    const options = {
      ...certOptions,
      allowHTTP1: true
    };

    this.#server = http2.createSecureServer(options);
    return this.#server;
  }

  /** @override */
  async protocolStart() {
    const handleSession = session => this.#addSession(session);

    this.#server.on('session', handleSession);

    // Try to tidy up in case of error.
    this.#server.on('error', () =>
      this.#server.removeListener('session', handleSession));
  }

  /** @override */
  async protocolStop() {
    this.#stopping = true;

    // Node docs indicate one has to explicitly close all HTTP2 sessions.
    for (const s of this.#sessions) {
      if (!s.closed) {
        s.close();
      }
    }
  }

  /** @override */
  async protocolWhenStopped() {
    if (this.#sessions.size !== 0) {
      await this.#fullyStopped.whenTrue();
    }
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

  /** @override */
  usesCertificates() {
    return true;
  }
}
