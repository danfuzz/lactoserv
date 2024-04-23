// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { HttpHeaders, IncomingRequest, RequestContext } from '@this/net-util';


/**
 * Utility class to construct {@link IncomingRequest} instances suitable for use
 * when testing the classes in this module.
 */
export class RequestUtil {
  /**
   * Makes a `GET` request with the given path.
   *
   * @param {string} path The path.
   * @returns {IncomingRequest} Corresponding request instance.
   */
  static makeGet(path) {
    return new IncomingRequest({
      context: new RequestContext(
        Object.freeze({ address: 'localhost', port: 12345 }),
        Object.freeze({ address: 'awayhost',  port: 54321 })),
      headers: new HttpHeaders({
        'some-header': 'something'
      }),
      protocolName: 'http-2',
      pseudoHeaders: new HttpHeaders({
        authority: 'your.host',
        method:    'get',
        path,
        scheme:    'https'
      })
    });
  }
}
