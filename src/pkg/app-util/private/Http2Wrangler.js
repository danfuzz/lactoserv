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
  /** @type {boolean} Is this instance stopped or trying to stop? */
  #stopping = false;

  /** @type {Condition} Has this instance fully stopped? */
  #fullyStopped = new Condition();

  /** @type {Set} Set of all currently-known sessions. */
  #sessions = new Set();

  // Note: Default constructor suffices.

  /** @override */
  _impl_createApplication() {
    // Express needs to be wrapped in order to use HTTP2.
    return http2ExpressBridge(express);
  }

  /** @override */
  _impl_createProtocolServer(hostOptions) {
    const options = {
      ...hostOptions,
      allowHTTP1: true
    };

    return http2.createSecureServer(options);
  }

  /** @override */
  async _impl_protocolStart() {
    const handleSession = session => this.#addSession(session);

    this.protocolServer.on('session', handleSession);

    // Try to tidy up in case of error.
    this.protocolServer.on('error', () =>
      this.protocolServer.removeListener('session', handleSession));
  }

  /** @override */
  async _impl_protocolStop() {
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
