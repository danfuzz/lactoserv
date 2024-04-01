// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AsyncLocalStorage } from 'node:async_hooks';
import * as http2 from 'node:http2';

import { Condition, PromiseUtil, Threadlet } from '@this/async';
import { WallClock } from '@this/clocks';

import { TcpWrangler } from '#p/TcpWrangler';
import { WranglerContext } from '#p/WranglerContext';


/**
 * Wrangler for `Http2SecureServer`.
 */
export class Http2Wrangler extends TcpWrangler {
  /**
   * High-level protocol server.
   *
   * @type {?http2.Http2Server}
   */
  #protocolServer = null;

  /**
   * Are there currently any sessions?
   *
   * @type {Condition}
   */
  #anySessions = new Condition();

  /**
   * Set of all currently-known sessions.
   *
   * @type {Set}
   */
  #sessions = new Set();

  /**
   * Thread which runs the high-level stack.
   *
   * @type {Threadlet}
   */
  #runner = new Threadlet(() => this.#run());

  /**
   * Per-connection storage, used to plumb connection context through to the
   * various objects that use the connection.
   *
   * @type {AsyncLocalStorage}
   */
  #perConnectionStorage = new AsyncLocalStorage();

  // @defaultConstructor

  /** @override */
  async _impl_init() {
    const hostOptions = this._prot_hostManager.getSecureServerOptions();
    const serverOptions = {
      ...hostOptions,
      allowHTTP1: true
    };

    const server = http2.createSecureServer(serverOptions);

    server.on('session', (session) => this.#addSession(session));
    server.on('request', (...args) => this._prot_incomingRequest(...args));

    // Set up an event handler to propagate the connection context. See
    // `WranglerContext.emitInContext()` for a treatise about what's going on.
    server.on('secureConnection', (socket) => WranglerContext.bindCurrent(socket));

    this.#protocolServer = server;
  }

  /** @override */
  _impl_server() {
    return this.#protocolServer;
  }

  /** @override */
  async _impl_serverStart(isReload_unused) {
    this.#runner.run();
  }

  /** @override */
  async _impl_serverStop(willReload_unused) {
    return this.#runner.stop();
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

    const connectionCtx    = WranglerContext.currentInstance;
    const connectionLogger = connectionCtx.connectionLogger;
    const sessionLogger    = this.logger?.sess.$newId;
    const sessionCtx       = WranglerContext.forSession(connectionCtx, session, sessionLogger);
    const sessions         = this.#sessions;

    connectionLogger?.newSession(sessionCtx.sessionId);
    sessionLogger?.opened({
      connectionId: connectionCtx.connectionId ?? '<unknown-id>'
    });

    sessions.add(session);
    connectionLogger?.totalSessions(sessions.size);
    this.#anySessions.value = true;

    const removeSession = () => {
      if (sessions.delete(session)) {
        if (sessions.size === 0) {
          this.#anySessions.value = false;
        }
        connectionLogger?.totalSessions(sessions.size);
      }
    };

    session.once('close', () => {
      removeSession();
      sessionLogger?.closed('ok');
    });
    session.on('error', (e) => {
      removeSession();
      sessionLogger?.closed('error', e);
    });
    session.once('goaway', (code) => {
      removeSession();
      sessionLogger?.closed('goaway', code);
    });
    session.once('frameError', (type, code, id) => {
      removeSession();
      sessionLogger?.closed('frameError', type, code, id);
    });

    // If we want to support the HTTP-2 protocol directly, this is where the
    // implementation would go. As things stand, we use the HTTP-1 compatibility
    // layer.
    /*
    session.on('stream', (stream, headers, flags, rawHeaders) => {
      connectionLogger?.streamOpened(rawHeaders, flags);
      stream.once('error', (e) => sessionLogger?.streamError(e));
      stream.once('close', () => sessionLogger?.streamClosed());
    });
    */

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
    sessionCtx.socket.on('close', () => {
      if (!session.closed) {
        session.close();

        // When we're in this situation, the HTTP2 library doesn't seem to emit
        // the expected `close` event by itself.
        session.emit('close');
      }
    });

    session.setTimeout(Http2Wrangler.#SESSION_TIMEOUT_MSEC, () => {
      sessionLogger?.idleTimeout();
      if (session.closed) {
        sessionLogger?.alreadyClosed();
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

      this.logger?.shuttingDown(op, this.#sessions.size);

      allClosed = true;
      for (const s of this.#sessions) {
        const ctx    = WranglerContext.get(s);
        const logger = ctx?.logger ?? this.logger?.['unknown-session'];

        if (s.closed) {
          logger?.alreadyClosed(op);
          continue;
        }

        logger?.shuttingDown(op);
        s[op]();
        allClosed = false;
      }

      if (allClosed) {
        break;
      }

      await PromiseUtil.race([
        this.#anySessions.whenFalse(),
        WallClock.waitForMsec(Http2Wrangler.#STOP_GRACE_PERIOD_MSEC)
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
        this.logger?.undeadSessions(undeadCount);
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
   * How long in msec to wait when stopping, after telling sessions to close
   * before closing with more extreme prejudice.
   *
   * @type {number}
   */
  static #STOP_GRACE_PERIOD_MSEC = 250;

  /**
   * How long in msec to wait for a session to have activity before considering
   * it "timed out" and telling it to close.
   *
   * @type {number}
   */
  static #SESSION_TIMEOUT_MSEC = 1 * 60 * 1000; // One minute.
}
