// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IncomingMessage } from 'node:http';
import { Http2ServerRequest } from 'node:http2';

import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { BaseIncomingRequest } from '#x/BaseIncomingRequest';
import { HttpHeaders } from '#x/HttpHeaders';
import { RequestContext } from '#x/RequestContext';


/**
 * Representation of an in-progress HTTP(ish) request, which is being serviced
 * by Node's low-level networking code.
 *
 * This class derives its data from the request object that comes from the
 * underlying Node libraries, along with additional sources, and it is intended
 * to offer a simpler (less crufty) and friendlier interface to them.
 */
export class IncomingRequest extends BaseIncomingRequest {
  //
  // Static members
  //

  /**
   * Constructs an instance based on a low-level Node HTTP-ish request object.
   *
   * @param {RequestContext} context Information about the request not
   *   represented in `request`.
   * @param {IncomingMessage|Http2ServerRequest} request Request object.
   * @param {?IntfLogger} logger Logger to use as a base, or `null` to not do
   *   any logging. If passed as non-`null`, the actual logger instance will be
   *   one that includes an additional subtag representing a new unique(ish) ID
   *   for the request.
   * @returns {IncomingRequest} Instance with data based on a low-level Node
   *   request (etc.).
   */
  static fromNodeRequest(request, context, logger) {
    // Note: It's impractical to do more thorough type checking here (and
    // probably not worth it anyway).
    MustBe.object(request);

    const { pseudoHeaders, headers } = IncomingRequest.#extractHeadersFrom(request);

    return new IncomingRequest({
      context,
      headers,
      logger,
      protocolName: `http-${request.httpVersion}`,
      pseudoHeaders
    });
  }

  /**
   * Extracts the two sets of headers from a low-level request object.
   *
   * @param {IncomingMessage|Http2ServerRequest} request Request object.
   * @returns {{ headers: HttpHeaders, pseudoHeaders: ?HttpHeaders }} The
   *   extracted headers.
   */
  static #extractHeadersFrom(request) {
    const modernHttp    = (request.httpVersionMajor >= 2);
    const headers       = new HttpHeaders();
    const pseudoHeaders = new HttpHeaders();

    let pendingKey = null;
    for (const s of request.rawHeaders) {
      if (pendingKey === null) {
        pendingKey = s;
      } else if (pendingKey[0] === ':') {
        pseudoHeaders.set(pendingKey.slice(1), s);
        pendingKey = null;
      } else {
        const key = modernHttp ? pendingKey : pendingKey.toLowerCase();
        pendingKey = null;
        switch (key) {
          case 'age': case 'authorization': case 'content-length':
          case 'content-type': case 'etag': case 'expires': case 'from':
          case 'if-modified-since': case 'if-unmodified-since':
          case 'last-modified': case 'location': case 'max-forwards':
          case 'proxy-authorization': case 'referer': case 'retry-after':
          case 'server': case 'user-agent': {
            // Duplicates of these headers are discarded (not combined), per
            // docs for `IncomingMessage.headers`.
            headers.set(key, s);
            break;
          }
          case 'host': {
            // Like above, duplicates are discarded. But in addition, for
            // HTTP-1-ish requests, this becomes the synthesized `:authority`
            // pseudo-header.
            headers.set(key, s);
            if (!modernHttp) {
              pseudoHeaders.set('authority', s);
            }
            break;
          }
          default: {
            // Everything else gets appended. There are special rules for
            // handling `cookie` and `set-cookie` headers, but those are taken
            // care of for us by `HttpHeaders`.
            headers.append(key, s);
            break;
          }
        }
      }
    }

    // Fill in the other pseudo-headers when given an HTTP-1-ish request.
    if (!modernHttp) {
      pseudoHeaders.set('method', request.method);
      pseudoHeaders.set('path',   request.url);
      // Note: No way to determine `:scheme` for these requests.
    }

    Object.freeze(headers);
    Object.freeze(pseudoHeaders);
    return { headers, pseudoHeaders };
  }
}
