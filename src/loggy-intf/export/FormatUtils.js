// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Utilities for logging.
 */
export class FormatUtils {
  /**
   * Makes a human-friendly network address/port string. This uses the bracketed
   * form for IPv6 addresses, to make it clear where the port number is.
   *
   * @param {?string} address The address, or `null` if not known. If passed as
   *   `null`, the literal string `<unknown>` is returned in place of the
   *   address.
   * @param {?number} [port] The port, or `null` if unknown or irrelevant. If
   *   passed as `null`, there is no port designation in the result.
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
