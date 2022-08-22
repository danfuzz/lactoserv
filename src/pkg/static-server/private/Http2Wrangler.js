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
   *
   * @param {object} config Configuration object.
   */
  constructor(config, actual) {
    const serverOptions = {
      key: config.key,
      cert: config.cert,
      allowHTTP1: true
    }

    const server = http2.createSecureServer(serverOptions);

    // Express needs to be wrapped in order to use HTTP2.
    const app = http2ExpressBridge(express);

    super(config, actual, server, app);

    this.#whenFullyStopped = new Promise((resolve) => {
      this.#resolveWhenFullyStopped = () => resolve(true);
    });
  }

  /** Per superclass requirement. */
  async sub_start() {
    const server = this.server;
    const handleSession = (session) => this.#addSession(session);

    server.on('session', handleSession);

    // Try to tidy up in case of error.
    server.on('error', () => server.removeListener('session', handleSession));
  }

  /** Per superclass requirement. */
  async sub_stop() {
    // Node docs indicate one has to explicitly close all HTTP2 sessions.
    for (const s of this.#sessions) {
      if (!s.closed) {
        s.close();
      }
    }
  }

  /** Per superclass requirement. */
  async sub_whenStopped() {
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
      if (this.stopping && (sessions.size == 0)) {
        this.#resolveWhenFullyStopped();
      }
    }

    session.on('close', removeSession);
    session.on('error', removeSession);
    session.on('frameError', removeSession);
    session.on('goaway', removeSession);

    if (this.stopping) {
      // Immediately close a session that managed to slip in while we're trying
      // to stop.
      session.close();
    }
  }
}
