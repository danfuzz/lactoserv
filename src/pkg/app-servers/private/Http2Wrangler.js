// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseWrangler } from '#p/BaseWrangler';

import express from 'express';
import http2ExpressBridge from 'http2-express-bridge';

import * as http2 from 'node:http2';

/**
 * Wrangler for `Http2SecureServer`.
 */
export class Http2Wrangler extends BaseWrangler {
  /** {net.Server|null} Server being wrangled, once known. */
  #server = null;

  /** {boolean} Is the server stopped or trying to stop? */
  #stopping = false;

  /** {Set} Set of all currently-known sessions. */
  #sessions = new Set();

  /** {Promise} Promise that resolves when sessions are no longer accepted and
   * all sessions have been closed. */
  #whenFullyStopped;

  /** {function} Function to call in order to resolve
   * {@link #whenFullyStopped}. */
  #resolveWhenFullyStopped;

  /**
   * Constructs an instance.
   */
  constructor() {
    super();

    this.#whenFullyStopped = new Promise((resolve) => {
      this.#resolveWhenFullyStopped = () => resolve(true);
    });
  }

  /** Per superclass requirement. */
  createApplication() {
    // Express needs to be wrapped in order to use HTTP2.
    return http2ExpressBridge(express);
  }

  /** Per superclass requirement. */
  createServer(hostManager) {
    // The `key` and `cert` bound here are for cases where the client doesn't
    // invoke the server-name extension. Hence, it's the wildcard.
    const wildcard = hostManager.findInfo('*');
    const sniCallback =
      (serverName, cb) => hostManager.sniCallback(serverName, cb);
    const serverOptions = {
      SNICallback: sniCallback,
      cert:        wildcard.cert,
      key:         wildcard.key,
      allowHTTP1:  true
    };

    return http2.createSecureServer(serverOptions);
  }

  /** Per superclass requirement. */
  async protocolStart(server) {
    this.#server = server;
    const handleSession = (session) => this.#addSession(session);

    server.on('session', handleSession);

    // Try to tidy up in case of error.
    server.on('error', () => server.removeListener('session', handleSession));
  }

  /** Per superclass requirement. */
  async protocolStop() {
    this.#stopping = true;

    // Node docs indicate one has to explicitly close all HTTP2 sessions.
    for (const s of this.#sessions) {
      if (!s.closed) {
        s.close();
      }
    }
  }

  /** Per superclass requirement. */
  async protocolWhenStopped() {
    await this.#whenFullyStopped;
  }

  /**
   * Called whenever a new HTTP2 session gets initiated.
   */
  #addSession(session) {
    const sessions = this.#sessions;

    sessions.add(session);

    const removeSession = () => {
      sessions.delete(session);
      if (this.#stopping && (sessions.size == 0)) {
        this.#resolveWhenFullyStopped();
      }
    }

    session.on('close', removeSession);
    session.on('error', removeSession);
    session.on('frameError', removeSession);
    session.on('goaway', removeSession);

    if (this.#stopping) {
      // Immediately close a session that managed to slip in while we're trying
      // to stop.
      session.close();
    }
  }
}
