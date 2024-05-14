// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Socket } from 'node:net';
import { Duplex, Readable, Writable } from 'node:stream';
import { setImmediate } from 'node:timers';

import { ManualPromise } from '@this/async';
import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';
import { TokenBucket } from '@this/webapp-util';


/**
 * Wrapper for a writable or duplex stream which rate-limits writes. This class
 * only works with streams in data mode (not object mode). It also explicitly
 * handles {@link Socket} instances, providing a few extra properties that it
 * has (compared to a generic {@link Duplex} stream).
 */
export class RateLimitedStream {
  /**
   * Underlying rate limiting provider.
   *
   * @type {TokenBucket}
   */
  #bucket;

  /**
   * The inner (wrapped) stream.
   *
   * @type {Duplex|Writable}
   */
  #innerStream;

  /**
   * Logger to use, or `null` to not do any logging.
   *
   * @type {?IntfLogger}
   */
  #logger;

  /**
   * Logger to use for verbose logging, or `null` not to do verbose logging.
   *
   * @type {?IntfLogger}
   */
  #verboseLogger;

  /**
   * The outer (exposed wrapper) stream.
   *
   * @type {Duplex|Writable}
   */
  #outerStream;

  /**
   * Count of total bytes written.
   *
   * @type {number}
   */
  #bytesWritten = 0;

  /**
   * Error received via `error` event from {@link #innerStream} or produced
   * internally, if any.
   *
   * @type {?Error}
   */
  #error = null;

  /**
   * Constructs an instance.
   *
   * @param {TokenBucket} bucket Provider of the underlying rate limiting
   *   service.
   * @param {Duplex|Writable} stream The stream to wrap.
   * @param {?IntfLogger} logger Logger to use.
   * @param {boolean} verboseLogging Log the minutiae of the instance's
   *   operation? If `false`, only major events (including errors) get logged.
   */
  constructor(bucket, stream, logger, verboseLogging) {
    this.#bucket        = MustBe.instanceOf(bucket, TokenBucket);
    this.#innerStream   = MustBe.instanceOf(stream, Writable);
    this.#logger        = logger?.dataRateLimiter;
    this.#verboseLogger = MustBe.boolean(verboseLogging) ? this.#logger : null;

    if (stream.readableObjectMode || stream.writableObjectMode) {
      throw new Error('Object mode not supported.');
    }

    this.#outerStream = this.#createWrapper();
    this.#logger?.started();
  }

  /** @returns {Duplex|Writable} The wrapper stream. */
  get stream() {
    return this.#outerStream;
  }

  /**
   * @returns {boolean} Indication of whether it's reasonable to try writing
   * to {@link #innerStream}.
   */
  get #canWriteInner() {
    const { closed, destroyed, writableEnded } = this.#innerStream;

    return (this.#error === null) && !(closed || destroyed || writableEnded);
  }

  /**
   * Reacts to an error that was received as an event or determined directly
   * within this class.
   *
   * @param {Error} error The error.
   * @param {boolean} [fromInnerEvent] Was it from an `error` event already
   *   emitted on {@link #innerStream}?
   */
  #becomeBroken(error, fromInnerEvent = false) {
    const logger = this.#logger;

    if (logger) {
      // Check for errors that don't particularly warrant including a stack
      // trace. (The `HPE*` errors come from the HTTP protocol parser.)
      const isMilquetoast =
        error.code && /^(ECONNRESET|HPE_)/.test(error.code);
      const thingToLog = isMilquetoast
        ? `${error.code}: ${error.message}`
        : error;

      if (fromInnerEvent) {
        this.#logger?.errorFromInner(thingToLog);
      } else {
        this.#logger?.error(thingToLog);
      }
    }

    if (!this.#error) {
      this.#error = error;
    }

    // Destroys the given stream, with appropriate safeguards so as to follow
    // the stream contract. Specifically, there is no point in `destroy()`ing a
    // stream that's already been destroyed, and if a stream is already closed,
    // then it's invalid to have it emit an `error`.
    const destroyStream = (stream, logName) => {
      logger?.[logName]();
      if (stream.destroyed) {
        if (stream.errored && (stream.errored !== error)) {
          // The stream in question was already errored, but with a different
          // error than the one we're trying to `destroy()` with.
          logger?.suppressingError('afterDestroy', error, stream.errored);
        }
      } else if (stream.closed) {
        logger?.suppressingError('afterClose', error);
        stream.destroy();
      } else {
        stream.destroy(error);
      }
    };

    if (!fromInnerEvent) {
      // Only do the `destroy()` work on `#innerStream` if we didn't end up here
      // because of a response to an already-emitted `error`.
      destroyStream(this.#innerStream, 'destroyingInner');
    }

    destroyStream(this.#outerStream, 'destroyingOuter');
  }

  /**
   * Creates and returns the wrapper stream.
   *
   * @returns {Duplex|Writable} The wrapper.
   */
  #createWrapper() {
    const inner      = this.#innerStream;
    const isReadable = inner instanceof Readable;
    const isSocket   = inner instanceof Socket;

    inner.on('close', () => this.#writableOnClose());
    inner.on('error', (error) => this.#onError(error));

    if (isReadable) {
      // Note: Adding a listener for the `readable` event (as is done here)
      // causes the stream to become "paused" (that is, it won't spontaneously
      // emit `data` events).
      inner.on('end',      () => this.#readableOnEnd());
      inner.on('readable', () => this.#readableOnReadable());
    }

    if (isSocket) {
      inner.on('timeout', () => {
        this.#logger?.timedOut();
        this.#outerStream.emit('timeout');
      });
    }

    if (isSocket) {
      return new RateLimitedStream.#SocketWrapper(this);
    } else if (isReadable) {
      return new RateLimitedStream.#DuplexWrapper(this);
    } else {
      return new RateLimitedStream.#WritableWrapper(this);
    }
  }

  /**
   * Processes a `_destroy()` call (indicator that the instance has been
   * "destroyed") from the outer stream.
   *
   * @param {?Error} error Optional error.
   * @param {function(Error)} callback Callback to call when this method is
   *   finished.
   */
  #destroy(error, callback) {
    // Note: We don't propagate the error to `#innerStream`, because it would
    // just end up re-emerging as a redundant `error` event and confusing the
    // innards of this class as well.
    this.#innerStream.destroy();

    if (error) {
      callback(error);
    } else {
      callback();
    }
  }

  /**
   * Handles an `error` event from the inner stream.
   *
   * @param {Error} error The error.
   */
  #onError(error) {
    this.#becomeBroken(error, true);
  }

  /**
   * Processes a `_read()` call (internal request to push data) from the outer
   * stream.
   *
   * @param {?number} size Request size hint (byte count)
   */
  #read(size = null) {
    const inner = this.#innerStream;
    const outer = this.#outerStream;

    for (;;) {
      const got = (size === null)
        ? inner.read()
        : (inner.read(size) ?? inner.read());
      if ((got === null) || !outer.push(got)) {
        break;
      }
    }
  }

  /**
   * Handles the `end` event from the inner stream, which is an indication that
   * the reading side has closed.
   */
  #readableOnEnd() {
    // `push(null)` is the spec-defined way to indicate to a `Readable` wrapper
    // that there is no more data to be read.
    this.#logger?.readableEnd();
    this.#outerStream.push(null);
  }

  /**
   * Handles the `readable` event from the inner stream, which indicates that
   * there is data which can be read and then pushed to the outer stream.
   */
  #readableOnReadable() {
    this.#read();
  }

  /**
   * Handles the `close` event from the inner stream, which indicates that (for
   * any number of reasons) the writing side of the stream has closed.
   */
  #writableOnClose() {
    this.#logger?.writableClose();
    this.#outerStream.end();

    // This unsticks any callers that happened to be stuck waiting for `drain`
    // inside `#write()`. It's a little bit ooky, but it's arguably cleaner than
    // adding extra stuff in `#write()` to deal with this very edgy egde case.
    this.#innerStream.emit('drain');
  }

  /**
   * Forwards a `write()` call from the outer to the inner stream.
   *
   * @param {Buffer} chunk Chunk to write.
   * @param {?string} encoding String encoding. Ignored (except when reporting
   *   an error) because `chunk` should only ever be a buffer.
   * @param {function(?Error)} callback Callback to call when writing is
   *   complete.
   */
  async #write(chunk, encoding, callback) {
    if (chunk instanceof Buffer) {
      this.#verboseLogger?.writing(chunk.length);
    } else {
      this.#becomeBroken(Error(`Unexpected non-buffer chunk with encoding ${encoding}.`));
      chunk = ''; // Ensure we'll fall through to the error case at the bottom.
    }

    const length = chunk.length;
    for (let at = 0; (at < length) && this.#canWriteInner; /*at*/) {
      const remaining   = length - at;
      const grantResult = await this.#bucket.requestGrant(
        { minInclusive: 1, maxInclusive: remaining });

      if (grantResult.waitTime.sec !== 0) {
        this.#verboseLogger?.waited(grantResult.waitTime);
      }

      if (!grantResult.done) {
        // This can happen when a stream is getting proactively closed (e.g.,
        // when the system is shutting down) or when there is too much
        // contention.
        const error = new Error(`Rate limited: ${grantResult.reason}`);
        error.code = `rate-limit-${grantResult.reason}`;

        this.#becomeBroken(error);
        this.#logger?.denied({ length, remaining, reason: grantResult.reason });
        break;
      }

      this.#bytesWritten += grantResult.grant;

      const subChunk = (length === grantResult.grant)
        ? chunk
        : chunk.subarray(at, at + grantResult.grant);

      // The state check after the `write()` call are to prevent us from waiting
      // for a `drain` event that would never get emitted.
      const keepGoing = this.#innerStream.write(subChunk)
        || !this.#canWriteInner;

      at += grantResult.grant;

      if (!keepGoing) {
        // The inner stream wants us to wait for a `drain` event. Oblige!
        this.#verboseLogger?.waitingForDrain();
        const mp = new ManualPromise();
        this.#innerStream.once('drain', () => { mp.resolve(); });
        await mp.promise;
        this.#verboseLogger?.drained();
      }
    }

    if (callback) {
      if (this.#error) {
        setImmediate(callback, this.#error);
      } else {
        setImmediate(callback);
      }
    }
  }


  //
  // Static members
  //

  /**
   * Wrapper for {@link Duplex} instances.
   */
  static #DuplexWrapper = class DuplexWrapper extends Duplex {
    /**
     * Outer instance.
     *
     * @type {RateLimitedStream}
     */
    #outerThis;

    /**
     * Constructs an instance.
     *
     * @param {RateLimitedStream} outerThis Outer instance.
     */
    constructor(outerThis) {
      super();

      this.#outerThis = outerThis;
      this.allowHalfOpen = outerThis.#innerStream.allowHalfOpen;
    }

    /** @override */
    _construct(callback) {
      // What's happening here is that we "link" the exposed `allowHalfOpen` to
      // the inner stream. Unfortunately, we can't just define a getter and
      // setter on the class directly, because the base `Duplex` constructor
      // itself tries to set `allowHalfOpen`, and that would fail because at
      // the moment it tries it the instance hasn't fully settled down as an
      // instance of this class and so couldn't function. (This was determined
      // empirically.)
      Object.defineProperty(this, 'allowHalfOpen', {
        configurable: false,
        get: () => this.#outerThis.#innerStream.allowHalfOpen,
        set: (v) => {
          this.#outerThis.#innerStream.allowHalfOpen = v;
        }
      });

      callback();
    }

    /** @override */
    _destroy(...args) {
      this.#outerThis.#destroy(...args);
    }

    /** @override */
    _read(...args) {
      this.#outerThis.#read(...args);
    }

    /** @override */
    _write(...args) {
      this.#outerThis.#write(...args);
    }
  };

  /**
   * Wrapper for {@link Socket} instances.
   */
  static #SocketWrapper = class SocketWrapper extends this.#DuplexWrapper {
    /**
     * Outer instance.
     *
     * @type {RateLimitedStream}
     */
    #outerThis;

    /**
     * Constructs an instance.
     *
     * @param {RateLimitedStream} outerThis Outer instance.
     */
    constructor(outerThis) {
      super(outerThis);
      this.#outerThis = outerThis;
    }

    /** @returns {number} Number of bytes written (`Socket` interface). */
    get bytesWritten() {
      return this.#outerThis.#innerStream.bytesWritten;
    }

    /** @returns {?string} Remote address (`Socket` interface). */
    get remoteAddress() {
      return this.#outerThis.#innerStream.remoteAddress;
    }

    /** @returns {?number} Remote port (`Socket` interface). */
    get remotePort() {
      return this.#outerThis.#innerStream.remotePort;
    }

    /**
     * @returns {number} The idle-timeout time, in msec (`Socket` interface).
     * `0` indicates that timeout is disabled.
     */
    get timeout() {
      return this.#outerThis.#innerStream.timeout;
    }

    /**
     * @param {number} timeoutMsec The new idle-timeout time, in msec. `0`
     * indicates that timeout is disabled.
     */
    set timeout(timeoutMsec) {
      this.setTimeout(timeoutMsec);
    }

    /**
     * Passthrough of same-named method to the underlying socket.
     */
    destroySoon() {
      if (!this.destroyed) {
        if (this.closed) {
          // The wrapper has already been closed. No need to wait before
          // proceeding with destruction.
          this.destroy();
        } else {
          // The wrapper hasn't been closed yet.
          if (!this.writableEnded) {
            // Nothing has even asked for it to close yet, so it's on us to do
            // that.
            this.end();
          }
          // Wait for the wrapper to actually be closed, and then proceed with
          // destruction.
          this.once('close', () => {
            this.destroy();
          });
        }
      }
    }

    /**
     * Sets a new value for the socket timeout, and optionally adds a `timeout`
     * listener.
     *
     * @param {number} timeoutMsec The new idle-timeout time, in msec. `0`
     *   indicates that timeout is disabled.
     * @param {?function()} [callback] Optional callback function.
     */
    setTimeout(timeoutMsec, callback = null) {
      MustBe.number(timeoutMsec, { finite: true, minInclusive: 0 });
      this.#outerThis.#innerStream.setTimeout(timeoutMsec);

      if (callback) {
        // Note: The `timeout` event gets plumbed through from the inner socket
        // to this instance in `createWrapper()`, above.
        this.on('timeout', callback);
      }
    }
  };

  /**
   * Wrapper for (non-{@link Duplex}) {@link Writable} instances.
   */
  static #WritableWrapper = class WritableWrapper extends Writable {
    /**
     * Outer instance.
     *
     * @type {RateLimitedStream}
     */
    #outerThis;

    /**
     * Constructs an instance.
     *
     * @param {RateLimitedStream} outerThis Outer instance.
     */
    constructor(outerThis) {
      super();
      this.#outerThis = outerThis;
    }

    /** @override */
    _destroy(...args) {
      this.#outerThis.#destroy(...args);
    }

    /** @override */
    _write(...args) {
      this.#outerThis.#write(...args);
    }
  };

  /**
   * Wraps a given stream with one that provides rate limiting based on the
   * given bucket, on its writing side. This accepts either a `stream.Writable`
   * (per se) or a `stream.Duplex` and in turn returns a new instance that
   * implements the same stream type.
   *
   * @param {TokenBucket} bucket Provider of the underlying rate limiting
   *   service.
   * @param {Duplex|Writable} stream The stream to wrap.
   * @param {?IntfLogger} logger Logger to use.
   * @returns {Duplex|Writable} A rate-limited wrapper stream.
   * @param {boolean} verboseLogging Log the minutiae of the instance's
   *   operation? If `false`, only major events (including errors) get logged.
   */
  static wrapWriter(bucket, stream, logger, verboseLogging) {
    return new this(bucket, stream, logger, verboseLogging).stream;
  }
}
