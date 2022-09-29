// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Buffer } from 'node:buffer';


/**
 * "Spy" on what's written to a writable-stream-like-thing.
 *
 * This is achieved by overwriting the target's `write()` and `end()` methods.
 */
export class WriteSpy {
  /** @type {object} Stream being spied upon. */
  #targetStream;

  /** @type {number} Number of bytes written. */
  #bytesWritten = 0;

  /**
   * Constructs an instance.
   *
   * @param {object} targetStream Stream to spy upon.
   * @param {function(...*)} logger Logger to use.
   */
  constructor(targetStream, logger) {
    this.#targetStream = targetStream;

    const origWrite = targetStream.write.bind(targetStream);
    const origEnd   = targetStream.end.bind(targetStream);
    targetStream.write = (...args) => {
      const { data, callback } = WriteSpy.#parseWriteArgs(args);
      if (data !== null) {
        this.#bytesWritten += data.length;
        logger.wroteBytes(data.length);
      }
      return callback ? origWrite(data, callback) : origWrite(data);
    };
    targetStream.end = (...args) => {
      const { data, callback } = WriteSpy.#parseWriteArgs(args);
      if (data === null) {
        return callback ? origEnd(callback) : origEnd();
      } else {
        this.#bytesWritten += data.length;
        logger.wroteBytes(data.length);
        return callback ? origEnd(data, callback) : origEnd(data);
      }
    };
  }

  /** @returns {number} The number of bytes written to the stream. */
  get bytesWritten() {
    return this.#bytesWritten;
  }


  //
  // Static members
  //

  /**
   * "Parses" arguments to a `write()`-like method, converting data strings to
   * buffers as appropriate.
   *
   * Node defines `write()` methods as having optional arguments, such that one
   * has to look at types to figure out what's what. This returns an object that
   * binds named arguments, making it much clearer what's happening at the use
   * site.
   *
   * @param {*[]} args Original arguments.
   * @returns {object} Parsed form.
   */
  static #parseWriteArgs(args) {
    let data     = null;
    let encoding = null;
    let callback = null;

    switch (args.length) {
      case 0: {
        // Nothing to set;
        break;
      }
      case 1: {
        if ((args[0] instanceof Uint8Array) || (typeof args[0] === 'string')) {
          data = args[0];
        } else {
          callback = args[0];
        }
        break;
      }
      case 2: {
        if ((args[0] instanceof Uint8Array) || (typeof args[0] === 'string')) {
          data = args[0];
          if (typeof args[1] === 'string') {
            encoding = args[1];
          } else {
            callback = args[1];
          }
        } else {
          // Shouldn't happen, because if you don't have a data argument, you
          // can't possibly have two valid arguments. (`encoding` without `data`
          // is nonsensical.) Nonetheless, we try to return the most sensible
          // thing.
          encoding = args[0];
          callback = args[1];
        }
        break;
      }
      default: {
        data     = args[0];
        encoding = args[1];
        callback = args[2];
        break;
      }
    }

    if (typeof data === 'string') {
      data = Buffer.from(data, encoding);
    }

    return { data, callback };
  }
}
