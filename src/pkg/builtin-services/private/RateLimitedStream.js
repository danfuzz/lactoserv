// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Readable, Writable, Duplex } from 'node:stream';

import { TokenBucket } from '@this/async';
import { MustBe } from '@this/typey';


/**
 * Wrapper for a writable or duplex stream which rate-limits writes. This class
 * only works with streams in data mode (not object mode).
 */
export class RateLimitedStream {
  /** @type {TokenBucket} Underlying rate limiting provider. */
  #bucket;

  /** @type {Duplex|Writable} The inner (wrapped) stream. */
  #innerStream;

  /** @type {?function(*)} Logger to use. */
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
   * @param {?function(*)} logger Logger to use.
   */
  constructor(bucket, stream, logger) {
    this.#bucket      = MustBe.object(bucket, TokenBucket);
    this.#innerStream = MustBe.object(stream, Writable);
    this.#logger      = logger;

    if (stream.readableObjectMode || stream.writableObjectMode) {
      throw new Error('Object mode not supported.');
    }

    this.#outerStream = this.#createWrapper();
    this.#logger?.rateLimitingStream();
  }

  /** @returns {number} Total number of bytes written. */
  get bytesWritten() {
    return this.#bytesWritten;
  }

  /** @returns {Duplex|Writable} The wrapper stream. */
  get stream() {
    return this.#outerStream;
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
    inner.on('error', () => this.#onError());

    if (hasReader) {
      // Note: Adding the `readable` listener causes the stream to become
      // "paused" (that is, it won't spontaneously emit `data` events).
      inner.on('end',      () => this.#readableOnEnd());
      inner.on('readable', () => this.#readableOnReadable());
    }

    return (inner instanceof Readable)
      ? new RateLimitedStream.#DuplexWrapper(this)
      : new RateLimitedStream.#WritableWrapper(this);
  }

  #onError(error) {
    this.#logger?.errorFromInnerStream(error);

    if (!this.#error) {
      this.#innerStream.destroy(error);
      this.#error = error;
    }
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
    this.#outerStream.push(null);
  }

  #readableOnReadable() {
    this.#read();
  }

  #writableOnClose() {
    this.#logger?.closeFromInnerStream();
    this.#outerStream.end();
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
  #write(chunk, encoding, callback) {
    if (!(chunk instanceof Buffer) && !this.#error) {
      this.#error = new Error(`Unexpected non-buffer chunk with encoding ${encoding}.`);
      this.#outerStream.destroy(this.#error);
    }

    if (this.#error) {
      callback(this.#error);
    }

    this.#logger?.writeFromOuter(chunk.length);

    // TODO: Rate limiting goes here!

    this.#bytesWritten += chunk.length;
    this.#innerStream.write(chunk, callback);
  }


  //
  // Static members
  //
  static #DuplexWrapper = class DuplexWrapper extends Duplex {
    #outerThis;

    constructor(outerThis) {
      super();
      this.#outerThis = outerThis;
    }

    get bytesWritten() {
      return this.#outerThis.bytesWritten;
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

  static #WritableWrapper = class WritableWrapper extends Writable {
    #outerThis;

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
   * @param {?function(*)} logger Logger to use.
   * @returns {Duplex|Writable} A rate-limited wrapper stream.
   */
  static wrapWriter(bucket, stream, logger) {
    return new this(bucket, stream, logger).stream;
  }
}
