// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Socket } from 'node:net';
import { Duplex, Readable, Writable } from 'node:stream';
import { setImmediate } from 'node:timers';

import { ManualPromise, TokenBucket } from '@this/async';
import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';


/**
 * Wrapper for a writable or duplex stream which rate-limits writes. This class
 * only works with streams in data mode (not object mode). It also explicitly
 * handles {@link Socket} instances, providing a few extra properties that it
 * has (compared to a generic {@link Duplex} stream).
 */
export class RateLimitedStream {
  /** @type {TokenBucket} Underlying rate limiting provider. */
  #bucket;

  /** @type {Duplex|Writable} The inner (wrapped) stream. */
  #innerStream;

  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /**
   * @type {Duplex|Writable} The outer (exposed wrapper) stream.
   */
  #outerStream;

  /** @type {number} Count of total bytes written. */
  #bytesWritten = 0;

  /**
   * @type {?Error} Error received via `error` event from {@link #innerStream}
   * or produced internally, if any.
   */
  #error = null;

  /**
   * Constructs an instance.
   *
   * @param {TokenBucket} bucket Provider of the underlying rate limiting
   *   service.
   * @param {Duplex|Writable} stream The stream to wrap.
   * @param {?IntfLogger} logger Logger to use.
   */
  constructor(bucket, stream, logger) {
    this.#bucket      = MustBe.instanceOf(bucket, TokenBucket);
    this.#innerStream = MustBe.instanceOf(stream, Writable);
    this.#logger      = logger.dataRateLimiter;

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
   * Reacts to an error that was received as an event or determined directly
   * within this class.
   *
   * @param {Error} error The error.
   * @param {boolean} [fromEvent = false] Was it from an `error` event?
   */
  #becomeBroken(error, fromEvent = false) {
    if (fromEvent) {
      this.#logger?.errorFromInner(error);
    } else {
      this.#logger?.error(error);
    }

    if (!this.#error) {
      this.#error = error;
    }

    if (!this.#outerStream.destroyed) {
      this.#logger?.destroyingOuter();
      this.#outerStream.destroy(error);
    }

    if (!this.#innerStream.destroyed) {
      this.#logger?.destroyingInner();
      this.#innerStream.destroy(error);
    }
  }

  /**
   * Creates and returns the wrapper stream.
   *
   * @returns {Duplex|Writable} The wrapper.
   */
  #createWrapper() {
    const inner     = this.#innerStream;
    const hasReader = inner instanceof Readable;

    inner.on('close', () => this.#writableOnClose());
    inner.on('error', (error) => this.#onError(error));

    if (hasReader) {
      // Note: Adding the `readable` listener causes the stream to become
      // "paused" (that is, it won't spontaneously emit `data` events).
      inner.on('end',      () => this.#readableOnEnd());
      inner.on('readable', () => this.#readableOnReadable());
    }

    if (inner instanceof Socket) {
      return new RateLimitedStream.#SocketWrapper(this);
    } else if (inner instanceof Readable) {
      return new RateLimitedStream.#DuplexWrapper(this);
    } else {
      return new RateLimitedStream.#WritableWrapper(this);
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
   * Handles the `end` event from the inner stream, which is an indication
   * that the reading side has closed.
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
   * Handles the `close` event from the inner stream, which indicates that
   * (for any number of reasons) the writing side of the stream has closed.
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
      this.#logger?.writing(chunk.length);
    } else {
      this.#becomeBroken(Error(`Unexpected non-buffer chunk with encoding ${encoding}.`));
      chunk = ''; // Ensure we'll fall through to the error case at the bottom.
    }

    const length = chunk.length;
    for (let at = 0; (at < length) && !this.#error; /*at*/) {
      const remaining   = length - at;
      const grantResult = await this.#bucket.requestGrant(
        { minInclusive: 1, maxInclusive: remaining });

      if (grantResult.waitTime !== 0) {
        this.#logger?.waited(grantResult.waitTime);
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

      const keepGoing = this.#innerStream.write(subChunk)
        || this.#innerStream.closed;

      if (!keepGoing) {
        // The inner stream wants us to wait for a `drain` event. Oblige!
        this.#logger?.waitingForDrain();
        const mp = new ManualPromise();
        this.#innerStream.once('drain', () => { mp.resolve(); });
        await mp.promise;
        this.#logger?.drained();
      }

      at += grantResult.grant;
    }

    if (this.#error) {
      setImmediate(callback, this.#error);
    } else {
      setImmediate(callback);
    }
  }


  //
  // Static members
  //

  /**
   * Wrapper for {@link Duplex} instances.
   */
  static #DuplexWrapper = class DuplexWrapper extends Duplex {
    /** @type {RateLimitedStream} Outer instance. */
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
    /** @type {RateLimitedStream} Outer instance. */
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
  };

  /**
   * Wrapper for (non-{@link Duplex}) {@link Wriatable} instances.
   */
  static #WritableWrapper = class WritableWrapper extends Writable {
    /** @type {RateLimitedStream} Outer instance. */
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
   */
  static wrapWriter(bucket, stream, logger) {
    return new this(bucket, stream, logger).stream;
  }
}
