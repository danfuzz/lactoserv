// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { Statter } from '@this/fs-util';
import { EtagGenerator, FullResponse, HttpUtil, IncomingRequest, MimeTypes }
  from '@this/net-util';
import { BaseConfig } from '@this/structy';
import { AskIf } from '@this/typey';


/**
 * Class which makes static content responses in a standardized form. This is
 * used by the built-in `StaticFiles` application, and it is provided separately
 * here to help with use cases which want a fairly standard behavior but where
 * not all of the behavior `StaticFiles` is required or appropriate.
 */
export class StaticFileResponder {
  /**
   * `cache-control` header to automatically include, or `null` not to do that.
   *
   * @type {?string}
   */
  #cacheControl = null;

  /**
   * Etag generator to use, or `null` if not using one.
   *
   * @type {?EtagGenerator}
   */
  #etagGenerator = null;

  /**
   * Constructs an instance.
   *
   * @param {?object} [config] Instance configuration, or `null` to use all
   *   defaults.
   * @param {?object|string} [config.cacheControl] `cache-control` header to
   *   automatically include, or `null` not to include it. Can be passed either
   *   as a literal string or an object to be passed to
   *   {@link HttpUtil#cacheControlHeader}. Default `null`.
   * @param {?object|true} [config.etag] Etag-generating options, `true` for
   *   standard options, or `null` not to include an `etag` header in responses.
   *   Default `null`.
   */
  constructor(config = null) {
    const { cacheControl, etag } = new StaticFileResponder.#Config(config);

    this.#cacheControl  = cacheControl;
    this.#etagGenerator = etag ? new EtagGenerator(etag) : null;
  }

  /**
   * Makes a response for the given absolute path. If the path is not an
   * existing file, this returns `null`.
   *
   * @param {IncomingRequest} request The original request.
   * @param {string} absolutePath The path to provide a response for.
   * @param {fs.Stats} [stats] The `stat()` result on the path, or `null` if not
   *   known.
   * @returns {?FullResponse} The response.
   */
  async makeResponse(request, absolutePath, stats = null) {
    if (!stats) {
      stats = await Statter.statOrNull(absolutePath);
      if (!stats) {
        return null;
      }
    }

    const contentType = MimeTypes.typeFromPathExtension(absolutePath);
    const rawResponse = new FullResponse();

    rawResponse.status = 200;
    rawResponse.headers.set('content-type', contentType);
    await rawResponse.setBodyFile(absolutePath, { stats });

    if (this.#cacheControl) {
      rawResponse.cacheControl = this.#cacheControl;
    }

    if (this.#etagGenerator) {
      rawResponse.headers.set('etag',
        await this.#etagGenerator.etagFromFile(absolutePath));
    }

    const { headers, method } = request;
    const response = rawResponse.adjustFor(
      method, headers, { conditional: true, range: true });

    return response;
  }


  //
  // Static members
  //

  /** @override */
  static #Config = class Config extends BaseConfig {
    // @defaultConstructor

    /**
     * `cache-control` header to automatically include, or `null` not to
     * include it. Can be passed either as a literal string or an object to be
     * passed to {@link HttpUtil#cacheControlHeader}.
     *
     * @param {?string|object} [value] Proposed configuration value. Default
     *   `null`.
     * @returns {?string} Accepted configuration value.
     */
    _config_cacheControl(value = null) {
      if (value === null) {
        return null;
      } else if (typeof value === 'string') {
        return value;
      } else if (AskIf.plainObject(value)) {
        return HttpUtil.cacheControlHeader(value);
      } else {
        throw new Error('Invalid `cacheControl` option.');
      }
    }

    /**
     * Etag-generating options, `true` for default options, or `null` not to
     * include an `etag` header in responses.
     *
     * @param {?object|true} [value] Proposed configuration value. Default
     *   `null`.
     * @returns {?object} Accepted configuration value.
     */
    _config_etag(value = null) {
      if (value === null) {
        return null;
      } else if (value === true) {
        return EtagGenerator.expandOptions({});
      } else if (AskIf.plainObject(value)) {
        return EtagGenerator.expandOptions(value);
      } else {
        throw new Error('Invalid `etag` option.');
      }
    }
  };
}
