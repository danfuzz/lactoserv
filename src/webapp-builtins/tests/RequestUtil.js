// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EndpointAddress, HttpHeaders, IncomingRequest, InterfaceAddress,
  RequestContext }
  from '@this/net-util';


/**
 * Utility class to construct {@link IncomingRequest} instances suitable for use
 * when testing the classes in this module.
 */
export class RequestUtil {
  /**
   * Makes a `GET` request with the given path and optional host.
   *
   * @param {string} path The path.
   * @param {?string} [host] The host.
   * @returns {IncomingRequest} Corresponding request instance.
   */
  static makeGet(path, host = undefined) {
    return this.makeRequest('get', path, host);
  }

  /**
   * Makes a request with the given request method and path, and optional host.
   *
   * @param {string} method The request method.
   * @param {string} path The path.
   * @param {string} [host] The host.
   * @returns {IncomingRequest} Corresponding request instance.
   */
  static makeRequest(method, path, host = 'your.host') {
    if (/^(?!\[).*:/.test(host)) {
      // Per the HTTP spec, an IPv6 host needs to end up being
      // bracket-surrounded in the `:authority` header.
      host = `[${host}]`;
    }

    return new IncomingRequest({
      context: new RequestContext(
        new InterfaceAddress('localhost:12345'),
        new EndpointAddress('99.88.77.66', 54321 )),
      headers: new HttpHeaders({
        'some-header': 'something'
      }),
      protocolName: 'http-2',
      pseudoHeaders: new HttpHeaders({
        authority: host,
        method,
        path,
        scheme:    'https'
      })
    });
  }
}
