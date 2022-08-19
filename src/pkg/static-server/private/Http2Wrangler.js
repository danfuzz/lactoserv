// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ServerWrangler } from '#p/ServerWrangler';

import express from 'express';
import http2ExpressBridge from 'http2-express-bridge';

import * as http2 from 'node:http2';
import { setTimeout } from 'node:timers/promises';

/**
 * Wrangler for `Http2SecureServer`.
 */
export class Http2Wrangler extends ServerWrangler {
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
      await setTimeout(1000);
      console.log('Done waiting.');
    }
  }

  #sessions = new Set();
  #zzz_count = 0;
  #addSession(session) {
    const id = this.#zzz_count++;
    const sessions = this.#sessions;

    sessions.add(session);
    console.log('### Added session %d', id);

    function removeSession() {
      console.log('### Removed session %d', id);
      sessions.delete(session);
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
