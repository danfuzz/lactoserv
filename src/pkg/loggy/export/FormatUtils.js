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
   * @param {?string} address The address, or `null` if not known. If passed as
   *   `null`, the literal string `<unknown>` is returned in place of the
   *   address.
   * @param {?number} [port = null] The port, or `null` if unknown or
   *   irrelevant. If passed as `null`, there is no port designation in the
   *   result.
   * @returns {string} The friendly form.
   */
  static addressPortString(address, port = null) {
    const portStr = (port === null) ? '' : `:${port}`;

    let addressStr;
    if (address === null) {
      // Unknown address.
      addressStr = '<unknown>';
    } else if (/^::ffff:.*[.]/.test(address)) {
      // IPv6 form, but it's a "wrapped" IPv4 address. Drop the subnet prefix.
      addressStr = address.slice(7);
    } else if (/:/.test(address)) {
      // IPv6 form.
      addressStr = `[${address}]`;
    } else {
      // Presumed to be IPv4 form.
      addressStr = address;
    }

    return `${addressStr}${portStr}`;
  }

  /**
   * Makes a human-friendly content length string, representing the value with
   * one of the suffixes `B`, `kB`, or `MB`. In the latter two cases, the
   * return value uses two digits after a decimal point unless the value is an
   * exact integer. The dividing line between `B` and `kB` is at 99999/100000
   * bytes. The dividing line between `kB` and `MB` is at 9999/10000 kilobytes.
   *
   * @param {?number} contentLength The content length. If passed as `null`,
   *   this method returns `<unknown-length>`.
   * @returns {string} The friendly form.
   */
  static contentLengthString(contentLength) {
    if (contentLength === null) {
      return '<unknown-length>';
    } else if (contentLength < 100000) {
      return `${contentLength}B`;
    } else if (contentLength < (10000 * 1024)) {
      const kilobytes = contentLength / 1024;
      return Number.isInteger(kilobytes)
        ? `${kilobytes}kB`
        : `${kilobytes.toFixed(2)}kB`;
    } else {
      const megabytes = contentLength / (1024 * 1024);
      return Number.isInteger(megabytes)
        ? `${megabytes}MB`
        : `${megabytes.toFixed(2)}MB`;
    }
  }

  /**
   * Makes a date/time string in a reasonably pithy and understandable form,
   * from a msec-time (e.g. the result from a call to `Date.now()`). The result
   * is a string represnting time in the UTC time zone.
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
   * from a standard Unix time in _seconds_ (not msec). The result is a string
   * represnting time in the UTC time zone.
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
   * Makes a human-friendly elapsed time string. The result string indicates
   * either `msec` or `sec`, and uses modest amounts of digits past the decimal
   * place.
   *
   * @param {number} elapsedMsec The elapsed time in msec.
   * @returns {string} The friendly form.
   */
  static elapsedTimeString(elapsedMsec) {
    const [amount, label] = (elapsedMsec < 1000)
      ? [elapsedMsec,        'msec']
      : [elapsedMsec / 1000, 'sec'];

    if (Number.isInteger(amount)) {
      return `${amount}${label}`;
    } else if (amount < 9.995) {
      return `${amount.toFixed(2)}${label}`;
    } else if (amount < 99.95) {
      return `${amount.toFixed(1)}${label}`;
    } else {
      return `${amount.toFixed(0)}${label}`;
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
