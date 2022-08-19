// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ServerWrangler } from '#p/ServerWrangler';

import express from 'express';
import http2ExpressBridge from 'http2-express-bridge';

import * as http2 from 'node:http2';

/**
 * Wrangler for `Http2SecureServer`.
 */
export class Http2Wrangler extends ServerWrangler {
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
  constructor(config) {
    const serverOptions = {
      key: config.key,
      cert: config.cert,
      allowHTTP1: true
    }

    const server = http2.createSecureServer(serverOptions);

    // Express needs to be wrapped in order to use HTTP2.
    const app = http2ExpressBridge(express);

    super(config, server, app);

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
    // If there are any remaining sessions, wait for them to stop. We can just
    // check the size of the `#sessions` set, because other code removes items
    // as they're closed.
    while (this.#sessions.size !== 0) {
      console.log('Waiting...');
      await this.#whenFullyStopped;
      console.log('Done waiting.');
    }
  }

  #zzz_count = 0;
  #addSession(session) {
    const id = this.#zzz_count++;
    const sessions = this.#sessions;

    sessions.add(session);
    console.log('### Added session %d', id);

    const removeSession = () => {
      sessions.delete(session);
      console.log('### Removed session %d; %s %d', id, this.stopping, sessions.size);
      if (this.stopping && (sessions.size == 0)) {
        console.log('### FULLY STOPPED');
        this.#resolveWhenFullyStopped();
      }
    }

    session.on('close', removeSession);
    session.on('error', removeSession);
    session.on('frameError', removeSession);
    session.on('goaway', removeSession);

    if (this.stopping) {
      console.log('### Immediately closing session %d', id);
      session.close();
    }
  }
}
