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
    return {
      secs:     durationSecs,
      duration: FormatUtils.durationStringFromSecs(durationSecs)
    };
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
   * @returns {string} The friendly form.
   */
  static byteCountString(byteCount) {
    if (byteCount === null) {
      return '<none>';
    } else if (byteCount < 100000) {
      return `${byteCount}B`;
    } else if (byteCount < (10000 * 1024)) {
      const kilobytes = byteCount / 1024;
      return Number.isInteger(kilobytes)
        ? `${kilobytes}kB`
        : `${kilobytes.toFixed(2)}kB`;
    } else {
      const megabytes = byteCount / (1024 * 1024);
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
   * @param {number} atSecs Time in the form of seconds since the Unix Epoch.
   * @param {object} [options = {}] Formatting options:
   *   * `{boolean} colons` -- Use colons to separate the time-of-day
   *     components? Defaults to `true`.
   *   * `{number} decimals` -- Number of fractional-second digits of precision.
   *     Defaults to `0`. **Note:** Fractions of seconds are truncated, not
   *     rounded.
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

  /**
   * Makes a human-friendly duration (elapsed time) string. The result string
   * represents a rounded value, in a format which varies based on the magnitude
   * of the duration.
   *
   * @param {number} durationSecs Duration in seconds.
   * @param {object} [options = {}] Formatting options:
   *   * `{boolean} spaces` -- Use spaces to separate the number from the units?
   *     If `false` an underscore is used. Defaults to `true`.
   * @returns {string} The friendly form.
   */
  static durationStringFromSecs(durationSecs, options = {}) {
    const { spaces = true } = options;

    const spaceyChar = spaces ? ' ' : '_';

    // For small numbers of (including fractional) seconds, just represent a
    // single number and a reasonable unit name.
    if (durationSecs < 99.9995) {
      const makeResult = (value, units) => {
        return `${value.toFixed(3)}${spaceyChar}${units}`;
      };

      if (durationSecs <= 0) {
        // This isn't generally expected to ever be the case in normal
        // operation, but produce something sensible just in case something goes
        // wonky.
        return (durationSecs === 0)
          ? `0${spaceyChar}sec${spaces ? ' (instantaneous)' : ''}`
          : makeResult(durationSecs, 'sec');
      }

      let   range = Math.floor(Math.floor(Math.log10(durationSecs)) / 3) * 3;
      let rounded = Math.round(durationSecs * (10 ** (-range + 3))) / 1000;
      if (rounded === 1000) {
        range += 3;
        rounded = 1;
      }
      switch (range) {
        case 0:  return makeResult(rounded, 'sec');
        case -3: return makeResult(rounded, 'msec');
        case -6: return makeResult(rounded, 'usec');
        case -9: return makeResult(rounded, 'nsec');
        default: {
          const roundedNsec = Math.round(durationSecs * (10 ** (9 + 3))) / 1000;
          return makeResult(roundedNsec, 'nsec');
        }
      }
    }

    // Convert `secs` to `BigInt`, because that makes the calculations much more
    // straightforward.
    const outputTenths = (durationSecs < ((60 * 60) - 0.05));
    const totalTenths  = outputTenths
      ? BigInt(Math.round(durationSecs * 10))
      : BigInt(Math.round(durationSecs) * 10);

    const tenths = totalTenths % 10n;
    const secs   = (totalTenths / 10n) % 60n;
    const mins   = (totalTenths / (10n * 60n)) % 60n;
    const hours  = (totalTenths / (10n * 60n * 60n)) % 24n;
    const days   = totalTenths / (10n * 60n * 60n * 24n);

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

    if (outputTenths) {
      parts.push('.', tenths);
    }

    return parts.join('');
  }
}
