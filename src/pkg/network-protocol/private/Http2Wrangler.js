// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as http2 from 'node:http2';
import * as timers from 'node:timers/promises';

import express from 'express';
import http2ExpressBridge from 'http2-express-bridge';

import { Condition, Threadlet } from '@this/async';

import { TcpWrangler } from '#p/TcpWrangler';
import { WranglerContext } from '#x/WranglerContext';


/**
 * Wrangler for `Http2SecureServer`.
 */
export class Http2Wrangler extends TcpWrangler {
  /** @type {?function(...*)} Logger, if logging is to be done. */
  #logger;

  /** @type {express} Express-like application. */
  #application;

  /** @type {?http2.Http2Server} High-level protocol server. */
  #protocolServer;

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

    const serverOptions = {
      ...options.hosts,
      allowHTTP1: true
    };

    // Express needs to be wrapped in order for it to use HTTP2.
    this.#application    = http2ExpressBridge(express);
    this.#protocolServer = http2.createSecureServer(serverOptions);

    this.#application.use('/', (req, res, next) => this.#tweakResponse(req, res, next));
    this.#protocolServer.on('session', (session) => this.#addSession(session));
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

    session.setTimeout(Http2Wrangler.#SESSION_TIMEOUT_MSEC, () => {
      ctx.sessionLogger?.idleTimeout();
      session.close();
    });
  }

  /**
   * Tweaks the response object of an incoming request. (Note: Actual high-level
   * application dispatch happens in the base class.)
   *
   * @param {http2.Http2ServerRequest} req_unused The incoming request.
   * @param {http2.Http2ServerResponse} res Response creator.
   * @param {function(?*)} next Next-middleware function.
   */
  #tweakResponse(req_unused, res, next) {
    // Express likes to set status messages, but HTTP2 doesn't actually have
    // those. Node helpfully warns about that, but in practice this is just an
    // artifact of Express wanting to not-rely on Node to get default status
    // messages right. So, it's reasonable to squelch the problem with this
    // somewhat grotty patch to the response object.
    Object.defineProperty(res, 'statusMessage', {
      get: () => '',
      set: () => { /* Ignore it. */ }
    });

    next();
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

      await Promise.race([
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
   * before telling it to close.
   */
  static #SESSION_TIMEOUT_MSEC = 5 * 60 * 1000; // Five minutes.
}
