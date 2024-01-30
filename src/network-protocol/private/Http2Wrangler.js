// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as http2 from 'node:http2';
import * as timers from 'node:timers/promises';

import express from 'express';
import http2ExpressBridge from 'http2-express-bridge';

import { Condition, PromiseUtil, Threadlet } from '@this/async';
import { IntfLogger } from '@this/loggy';

import { TcpWrangler } from '#p/TcpWrangler';
import { WranglerContext } from '#x/WranglerContext';


/**
 * Wrangler for `Http2SecureServer`.
 */
export class Http2Wrangler extends TcpWrangler {
  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /** @type {express} Express-like application. */
  #application;

  /** @type {?http2.Http2Server} High-level protocol server. */
  #protocolServer = null;

  /** @type {Condition} Are there currently any sessions? */
  #anySessions = new Condition();

  /** @type {Set} Set of all currently-known sessions. */
  #sessions = new Set();

  /** @type {Threadlet} Thread which runs the high-level stack. */
  #runner = new Threadlet(() => this.#run());

  /**
   * Constructs an instance.
   *
   * @param {object} options Construction options, per the base class spec.
   */
  constructor(options) {
    super(options);

    this.#logger = options.logger?.http2 ?? null;

    // Express needs to be wrapped in order for it to use HTTP2.
    this.#application = http2ExpressBridge(express);
  }

  /** @override */
  _impl_application() {
    return this.#application;
  }

  /** @override */
  async _impl_applicationStart(isReload_unused) {
    this.#runner.run();
  }

  /** @override */
  async _impl_applicationStop(willReload_unused) {
    return this.#runner.stop();
  }

  /** @override */
  async _impl_initialize() {
    if (!this.#protocolServer) {
      const hostOptions = await this._prot_hostManager.getSecureServerOptions();
      const serverOptions = {
        ...hostOptions,
        allowHTTP1: true
      };

      this.#protocolServer = http2.createSecureServer(serverOptions);
      this.#protocolServer.on('session', (session) => this.#addSession(session));
    }
  }

  /** @override */
  _impl_server() {
    return this.#protocolServer;
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

    const ctx      = this._prot_newSession(session);
    const sessions = this.#sessions;

    sessions.add(session);
    this.#anySessions.value = true;

    ctx.connectionLogger?.totalSessions(sessions.size);

    const removeSession = () => {
      if (sessions.delete(session)) {
        if (sessions.size === 0) {
          this.#anySessions.value = false;
        }
        ctx.connectionLogger?.totalSessions(sessions.size);
      }
    };

    // Note: `ProtocolWrangler` logs each of these events, so no need to do that
    // here.
    session.on('close',      removeSession);
    session.on('error',      removeSession);
    session.on('frameError', removeSession);
    session.on('goaway',     removeSession);

    // What's going on: If the underlying socket was closed and we didn't do
    // anything here (that is, if this event handler weren't added), the HTTP2
    // session-handling code wouldn't fully notice by itself. Later, the session
    // would do its idle timeout, and the callback here (below) would try to
    // close the session. At that point, the HTTP2 system would get confused and
    // end up throwing an unhandleable error (method call on the internal socket
    // reference, except the reference had gotten `null`ed out). So, with that
    // as context, if -- as we do here -- we tell the session to close as soon
    // as we see the underlying socket go away, there's no internal HTTP2 error.
    // Salient issues in Node:
    //   * <https://github.com/nodejs/node/issues/35695>
    //   * <https://github.com/nodejs/node/issues/46094>
    ctx.socket.on('close', () => {
      if (!session.closed) {
        session.close();

        // When we're in this situation, the HTTP2 library doesn't seem to emit
        // the expected `close` event by itself.
        session.emit('close');
      }
    });

    session.setTimeout(Http2Wrangler.#SESSION_TIMEOUT_MSEC, () => {
      ctx.sessionLogger?.idleTimeout();
      if (session.closed) {
        ctx.sessionLogger?.alreadyClosed();
      } else {
        session.close();
      }
    });
  }

  /**
   * Runs the high-level stack.
   */
  async #run() {
    // As things stand, there isn't actually anything to do other than wait for
    // the stop request and then shut things down.
    await this.#runner.whenStopRequested();

    this.#protocolServer.close();

    // Node docs indicate one has to explicitly close all HTTP2 sessions. What
    // we do here is _first_ try to nicely close (let the other side know what's
    // happening), and then if actual closing doesn't happen quickly go ahead
    // and thwack things totally closed.

    let allClosed = false;

    for (const op of ['close', 'destroy']) {
      if (this.#sessions.size === 0) {
        allClosed = true;
        break;
      }

      this.#logger?.shuttingDown(op, this.#sessions.size);

      allClosed = true;
      for (const s of this.#sessions) {
        const ctx = WranglerContext.get(s);

        if (s.closed) {
          ctx.logger?.alreadyClosed(op);
          continue;
        }

        ctx.logger?.shuttingDown(op);
        s[op]();
        allClosed = false;
      }

      if (allClosed) {
        break;
      }

      await PromiseUtil.race([
        this.#anySessions.whenFalse(),
        timers.setTimeout(Http2Wrangler.#STOP_GRACE_PERIOD_MSEC)
      ]);
    }

    if (this.#sessions.size !== 0) {
      // There seems to be a bug in Node (probably
      // <https://github.com/nodejs/node/issues/46094>) which prevents session
      // close/shutdown from totally working. The upshot of this -- at least as
      // is salient to the code here -- is that, though the session ends up
      // claiming to be closed, the `close` event on it never gets fired, so
      // `#sessions` never drops it. We check for that here, and if detected,
      // log the fact and also prevent the `throw` below from firing.
      let undeadCount = 0;
      for (const s of this.#sessions) {
        if (s.closed) {
          undeadCount++;
        }
      }

      if (undeadCount !== 0) {
        this.#logger?.undeadSessions(undeadCount);
        if (undeadCount === this.#sessions.size) {
          allClosed = true;
        }
      }
    }

    if (!allClosed) {
      throw new Error('Could not shut down all sessions.');
    }
  }


  //
  // Static members
  //

  /**
   * @type {number} How long in msec to wait when stopping, after telling
   * sessions to close before closing with more extreme prejudice.
   */
  static #STOP_GRACE_PERIOD_MSEC = 250;

  /**
   * @type {number} How long in msec to wait for a session to have activity
   * before considering it "timed out" and telling it to close.
   */
  static #SESSION_TIMEOUT_MSEC = 1 * 60 * 1000; // One minute.

  static {
    // Various networking code (that we don't control) occasionally uses the
    // `.statusMessage` setter, but HTTP2 doesn't actually have status messages,
    // and Node "helpfully" warns about that. But in practice, the warnings are
    // just an annoying reminder of dependencies that we can't in practice
    // usefully tweak. So, it's reasonable to squelch the problem with this
    // somewhat grotty patch.
    const proto = http2.Http2ServerResponse.prototype;
    Object.defineProperty(proto, 'statusMessage', {
      get: () => '',
      set: () => { /* Ignore it. */ }
    });
  }
}
