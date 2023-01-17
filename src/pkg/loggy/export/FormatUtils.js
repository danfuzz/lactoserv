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
   * Makes a very friendly compound date-time object, which represents both
   * seconds since the Unix Epoch as well as a string indicating the date-time
   * in UTC.
   *
   * @param {number} dateTimeSecs Time in the form of seconds since the Unix
   *   Epoch.
   * @param {object} [options = {}] Options, as with {@link
   *   #dateTimeStringFromSecs}.
   * @returns {object} Friendly compound object.
   */
  static compoundDateTimeFromSecs(dateTimeSecs, options = {}) {
    return {
      secs: dateTimeSecs,
      utc:  FormatUtils.dateTimeStringFromSecs(dateTimeSecs, options)
    };
  }

  /**
   * Makes a friendly compound object representing a temporal duration, with
   * both an exact number of seconds (the original value) and a human-oriented
   * string whose format varies based on the magnitude of the duration and which
   * represents the rounded value.
   *
   * @param {number} secs Duration in seconds.
   * @returns {object} Friendly compound object.
   */
  static compoundDurationFromSecs(secs) {
    const result = { secs };

    // For small numbers of seconds, just represent a single number and a
    // reasonable unit name.
    if (secs <= 99.9995) {
      const makeResult = (power, units) => {
        const value = secs * (10 ** power);
        result.duration = `${value.toFixed(3)} ${units}`;
        return result;
      };

      if (secs <= 0) {
        // This isn't generally expected to ever be the case in normal
        // operation, but produce something sensible just in case something goes
        // wonky.
        if (secs === 0) {
          result.duration = '0 sec (instantaneous)';
          return result;
        } else {
          return makeResult(0, 'sec');
        }
      }

      let   range   = Math.floor(Math.floor(Math.log10(secs)) / 3) * 3;
      const rounded = Math.round(secs * (10 ** (-range + 3))) / 1000;
      if (rounded === 1000) {
        range += 3;
      }
      switch (range) {
        case 0:  return makeResult(0, 'sec');
        case -3: return makeResult(3, 'msec');
        case -6: return makeResult(6, 'usec');
        default: return makeResult(9, 'nsec');
      }
    }

    // Convert `secs` to `BigInt`, because that makes the calculations much more
    // straightforward.
    secs = BigInt(Math.round(secs));

    const mins  = (secs / 60n) % 60n;
    const hours = (secs / (60n * 60n)) % 24n;
    const days  = secs / (60n * 60n * 24n);
    secs = secs % 60n;

    const parts = [];

    if (days > 0) {
      parts.push(days, 'd ');
    }

    if ((hours > 0) || (days > 0)) {
      if (hours < 10n) {
        parts.push('0');
      }
      parts.push(hours, ':');
    }

    if (mins < 10) {
      parts.push('0');
    }
    parts.push(mins, ':');

    if (secs < 10) {
      parts.push('0');
    }
    parts.push(secs);

    result.duration = parts.join('');

    return result;
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
   * from a standard Unix time in _seconds_ (not msec). The result is a string
   * represnting time in the UTC time zone.
   *
   * @param {number} dateTimeSecs Unix-style time, in _seconds_ (not msec).
   * @param {object} [options = {}] Formatting options:
   *   * `{boolean} colons` -- Use colons to separate the time-of-day
   *     components? Defaults to `true`.
   *   * `{number} decimals` -- Number of fractional-second digits of precision.
   *     Defaults to `0`. **Note:** Fractions of seconds are truncated, not
   *     rounded.
   * @returns {string} The friendly time string.
   */
  static dateTimeStringFromSecs(dateTimeSecs, options = {}) {
    const { colons = true, decimals = 0 } = options;

    const d       = new Date(dateTimeSecs * this.#MSEC_PER_SEC);
    const timeSep = colons ? ':' : '';
    const parts   = [
      d.getUTCFullYear().toString(),
      (d.getUTCMonth() + 1).toString().padStart(2, '0'),
      d.getUTCDate().toString().padStart(2, '0'),
      '-',
      d.getUTCHours().toString().padStart(2, '0'),
      timeSep,
      d.getUTCMinutes().toString().padStart(2, '0'),
      timeSep,
      d.getUTCSeconds().toString().padStart(2, '0')
    ];

    if (decimals !== 0) {
      // Non-obvious: If you take `secs % 1` and then operate on the remaining
      // fraction, you can end up with a string representation that's off by 1,
      // because of floating point (im)precision. That's why we _don't_ do that.
      const tenPower = 10 ** decimals;
      const frac     = Math.floor(dateTimeSecs * tenPower % tenPower);
      const fracStr  = frac.toString().padStart(decimals, '0');
      parts.push('.', fracStr);
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
  static durationString(elapsedMsec) {
    // TODO: This method should be combined with the code that handles the
    // `duration` result in {@link #compoundDurationFromSecs}.

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
