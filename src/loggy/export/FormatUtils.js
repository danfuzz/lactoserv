// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Utilities for logging.
 */
export class FormatUtils {
  /**
   * Makes a human-friendly network address/port string.
   *
   * @param {?string} address The address, or `null` if not known. If passed as
   *   `null`, the literal string `<unknown>` is returned in place of the
   *   address.
   * @param {?number} [port] The port, or `null` if unknown or
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
   * @param {object} [options] Formatting options.
   * @param {boolean} [options.spaces] Use spaces to separate the number
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
   * Makes a human-friendly network interface specification string. The given
   * object is expected to either bind `address` and `port` (with `port`
   * possibly being `null` but _not_ `undefined`), _or_ bind `fd`.
   *
   * @param {object} iface The interface specification to convert.
   * @returns {string} The friendly form.
   */
  static networkInterfaceString(iface) {
    return (Object.hasOwn(iface, 'fd'))
      ? `/dev/fd/${iface.fd}`
      : this.addressPortString(iface.address, iface.port);
  }
}
