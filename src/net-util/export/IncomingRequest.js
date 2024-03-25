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
  /** @type {HttpHeaders} Incoming request headers. */
  #requestHeaders;

  /** @type {string} The protocol name. */
  #protocolName;

  /** @type {string} The request method, downcased. */
  #requestMethod;

  /**
   * Constructs an instance.
   *
   * @param {RequestContext} context Information about the request not
   *   represented in `request`.
   * @param {IncomingMessage|Http2ServerRequest} request Request object.
   * @param {?IntfLogger} logger Logger to use as a base, or `null` to not do
   *   any logging. If passed as non-`null`, the actual logger instance will be
   *   one that includes an additional subtag representing a new unique(ish) ID
   *   for the request.
   */
  constructor(context, request, logger) {
    // Note: It's impractical to do more thorough type checking here (and
    // probably not worth it anyway).
    MustBe.object(request);

    super({
      context,
      logger,
      protocolName:  `http-${request.httpVersion}`,
      requestMethod: request.method.toLowerCase(),
      targetString:  request.url
    });

    this.#requestHeaders = new HttpHeaders(request.headers);
  }

  /** @override */
  get headers() {
    return this.#requestHeaders;
  }
}
