// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Duration } from '@this/data-values';

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
   * Makes a human-friendly byte-count string, representing the value with one
   * of the suffixes `B`, `kB`, or `MB`. In the latter two cases, the return
   * value uses two digits after a decimal point unless the value is an exact
   * integer. The dividing line between `B` and `kB` is at 99999/100000 bytes.
   * The dividing line between `kB` and `MB` is at 9999/10000 kilobytes.
   *
   * @param {?number} byteCount The byte count length. If passed as `null`,
   *   this method returns `<none>`.
   * @param {object} [options = {}] Formatting options.
   * @param {boolean} [options.spaces = true] Use spaces to separate the number
   *   from the units? If `false` an underscore is used.
   * @returns {string} The friendly form.
   */
  static byteCountString(byteCount, options = {}) {
    const { spaces = true } = options;
    const spaceyChar        = spaces ? ' ' : '_';

    if (byteCount === null) {
      return '<none>';
    } else if (byteCount < 100000) {
      return `${byteCount}${spaceyChar}B`;
    } else if (byteCount < (10000 * 1024)) {
      const kilobytes = byteCount / 1024;
      return Number.isInteger(kilobytes)
        ? `${kilobytes}${spaceyChar}kB`
        : `${kilobytes.toFixed(2)}${spaceyChar}kB`;
    } else {
      const megabytes = byteCount / (1024 * 1024);
      return Number.isInteger(megabytes)
        ? `${megabytes}${spaceyChar}MB`
        : `${megabytes.toFixed(2)}${spaceyChar}MB`;
    }
  }

  /**
   * Makes a very friendly compound date-time object, which represents both
   * seconds since the Unix Epoch as well as a string indicating the date-time
   * in UTC.
   *
   * @param {number} atSecs Time in the form of seconds since the Unix Epoch.
   * @param {object} [options = {}] Options, as with {@link
   *   #dateTimeStringFromSecs}.
   * @returns {object} Friendly compound object.
   */
  static compoundDateTimeFromSecs(atSecs, options = {}) {
    return {
      atSecs,
      utc:  FormatUtils.dateTimeStringFromSecs(atSecs, options)
    };
  }

  /**
   * Makes a friendly compound object representing a temporal duration, with
   * both an exact number of seconds (the original value) and a human-oriented
   * string whose format varies based on the magnitude of the duration and which
   * represents the rounded value.
   *
   * @param {number} durationSecs Duration in seconds.
   * @returns {object} Friendly compound object.
   */
  static compoundDurationFromSecs(durationSecs) {
    return Duration.plainObjectFromSecs(durationSecs);
  }

  /**
   * Makes a date/time string in a reasonably pithy and understandable form,
   * from a standard Unix time in _seconds_ (not msec). The result is a string
   * represnting time in the UTC time zone.
   *
   * @param {number} atSecs Time in the form of seconds since the Unix Epoch.
   * @param {object} [options = {}] Formatting options.
   * @param {boolean} [options.colons = true] Use colons to separate the
   *   time-of-day components?
   * @param {number} [options.decimals = 0] Number of fractional-second digits
   *    of precision. **Note:** Fractions of seconds are truncated, not rounded.
   * @returns {string} The friendly time string.
   */
  static dateTimeStringFromSecs(atSecs, options = {}) {
    const { colons = true, decimals = 0 } = options;

    const d       = new Date(atSecs * this.#MSEC_PER_SEC);
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
      // Non-obvious: If you take `atSecs % 1` and then operate on the remaining
      // fraction, you can end up with a string representation that's off by 1,
      // because of floating point (im)precision. That's why we _don't_ do that.
      const tenPower = 10 ** decimals;
      const frac     = Math.floor(atSecs * tenPower % tenPower);
      const fracStr  = frac.toString().padStart(decimals, '0');
      parts.push('.', fracStr);
    }

    return parts.join('');
  }
}
