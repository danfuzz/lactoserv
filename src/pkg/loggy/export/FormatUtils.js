// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.


/**
 * Utilities for logging.
 */
export class FormatUtils {
  /** @type {number} Number of milliseconds in a second. */
  static #MSEC_PER_SEC = 1000;

  /**
   * Makes a human-friendly network address/port string.
   *
   * @param {?string} [address = null] The address, or `null` if not known.
   * @param {?number} [port = null] The port, or `null` if unknown or
   *   irrelevant.
   * @returns {string} The friendly form.
   */
  static addressPortString(address = null, port = null) {
    if (address === null) {
      if (port === null) {
        return '<unknown-address>';
      } else {
        return `<unknown-address>:${port}`;
      }
    }

    if (port === null) {
      return address;
    }

    if (/:/.test(address)) {
      // IPv6 form.
      return `[${address}]:${port}`;
    } else {
      // IPv4 form.
      return `${address}:${port}`;
    }
  }

  /**
   * Makes a human-friendly content length string.
   *
   * @param {?number} contentLength The content length.
   * @returns {string} The friendly form.
   */
  static contentLengthString(contentLength) {
    if (contentLength === null) {
      return '<unknown-length>';
    } else if (contentLength < 1024) {
      return `${contentLength}B`;
    } else if (contentLength < (1024 * 1024)) {
      const kilobytes = (contentLength / 1024).toFixed(2);
      return `${kilobytes}kB`;
    } else {
      const megabytes = (contentLength / 1024 / 1024).toFixed(2);
      return `${megabytes}MB`;
    }
  }

  /**
   * Makes a date/time string in a reasonably pithy and understandable form,
   * from a msec-time (e.g. the result from a call to `Date.now()`).
   *
   * @param {number} dateTimeMsec Unix-style time, in msec.
   * @param {boolean} [wantFrac = false] Should the result include fractional
   *   seconds?
   * @returns {string} The friendly time string.
   */
  static dateTimeStringFromMsec(dateTimeMsec, wantFrac = false) {
    return this.dateTimeStringFromSecs(dateTimeMsec / 1000, wantFrac);
  }

  /**
   * Makes a date/time string in a reasonably pithy and understandable form,
   * from a standard Unix time in _seconds_ (not msec).
   *
   * @param {number} dateTimeSecs Unix-style time, in _seconds_ (not msec).
   * @param {boolean} [wantFrac = false] Should the result include fractional
   *   seconds?
   * @returns {string} The friendly time string.
   */
  static dateTimeStringFromSecs(dateTimeSecs, wantFrac = false) {
    const secs = Math.trunc(dateTimeSecs);
    const frac = dateTimeSecs - secs;
    const d    = new Date(secs * this.#MSEC_PER_SEC);

    const parts = [
      d.getUTCFullYear().toString(),
      (d.getUTCMonth() + 1).toString().padStart(2, '0'),
      d.getUTCDate().toString().padStart(2, '0'),
      '-',
      d.getUTCHours().toString().padStart(2, '0'),
      d.getUTCMinutes().toString().padStart(2, '0'),
      d.getUTCSeconds().toString().padStart(2, '0')
    ];

    if (wantFrac) {
      parts.push(frac.toFixed(4).slice(1));
    }

    return parts.join('');
  }

  /**
   * Makes a human-friendly elapsed time string.
   *
   * @param {number} elapsedMsec The elapsed time in msec.
   * @returns {string} The friendly form.
   */
  static elapsedTimeString(elapsedMsec) {
    if (elapsedMsec < 10) {
      const msec = elapsedMsec.toFixed(2);
      return `${msec}msec`;
    } else if (elapsedMsec < 1000) {
      const msec = elapsedMsec.toFixed(0);
      return `${msec}msec`;
    } else {
      const sec = (elapsedMsec / 1000).toFixed(1);
      return `${sec}sec`;
    }
  }

  /**
   * Makes a JSON-encodable version of an `Error` as a plain object. Returns
   * non-`Error`s as-is.
   *
   * @param {*} error Presumed `Error`.
   * @returns {*} JSON-encodable version of `error` if it is indeed an `Error`,
   *   or the original `error` value if not.
   */
  static errorObject(error) {
    if (!(error instanceof Error)) {
      return error;
    }

    const result = {
      errorClass: error.constructor.name,
      message:    error.message,
    };

    if (error.code) {
      result.code = error.code;
    }

    // Not included in the initial `result` assignment above, so that it gets
    // emitted last when JSON-encoded.
    result.stack = error.stack;

    return result;
  }
}
