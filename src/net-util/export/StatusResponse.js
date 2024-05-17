// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { FullResponse } from '#x/FullResponse';
import { IncomingRequest } from '#x/IncomingRequest';


/**
 * Response to an HTTP-ish request consisting _just_ of a status code. This can
 * (and is expected to) be used when an application wants to report an error but
 * doesn't want to fill in the details of the body. When asked to respond with
 * one of these, the system will _actually_ construct a body (if appropriate)
 * and headers for the ultimate response to the network client.
 *
 * Instances of this class are always frozen.
 */
export class StatusResponse {
  /**
   * The response status code, or `null` if not yet set.
   *
   * @type {?number}
   */
  #status = null;

  /**
   * Constructs an instance.
   *
   * @param {number} status The status code of the response.
   */
  constructor(status) {
    this.#status =
      MustBe.number(status, { safeInteger: true, minInclusive: 100, maxInclusive: 599 });
    Object.freeze(this);
  }

  /**
   * @returns {number} The HTTP-ish response status code.
   */
  get status() {
    return this.#status;
  }

  /**
   * Expands this instance into a complete response object, given a specific
   * request it is to respond to.
   *
   * @param {IncomingRequest} request Request to respond to.
   * @returns {FullResponse} The full response to send.
   */
  responseFor(request) {
    MustBe.instanceOf(request, IncomingRequest);

    const status = this.#status;

    if (status === 404) {
      const bodyExtra = request.urlForLog;
      return FullResponse.makeNotFound({ bodyExtra });
    } else {
      return FullResponse.makeMetaResponse(status);
    }
  }


  //
  // Static members
  //

  /**
   * Map from a status to a cached instance for same.
   *
   * @type {Map<number, StatusResponse>}
   */
  static #INSTANCES = new Map();

  /**
   * @returns {StatusResponse} The "not found" (`404`) instance.
   */
  static get NOT_FOUND() {
    return this.fromStatus(404);
  }

  /**
   * Gets an instance for the given status. This method returns cached
   * instances; no more than one instance per status is created by this method.
   *
   * @param {number} status The response status code.
   * @returns {StatusResponse} An instance of this class for the given status.
   */
  static fromStatus(status) {
    const already = this.#INSTANCES.get(status);

    if (already) {
      return already;
    }

    const result = new StatusResponse(status);

    this.#INSTANCES.set(status, result);
    return result;
  }
}
