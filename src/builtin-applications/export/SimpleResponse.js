// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { Paths, Statter } from '@this/fs-util';
import { EtagGenerator, Response, HttpUtil, MimeTypes } from '@this/net-util';
import { ApplicationConfig } from '@this/sys-config';
import { BaseApplication } from '@this/sys-framework';
import { MustBe } from '@this/typey';


/**
 * Simple response server. See docs for configuration object details.
 */
export class SimpleResponse extends BaseApplication {
  /** @type {Response} Response template to clone for all actual responses. */
  #response = null;

  // Note: The default contructor is fine for this class.

  /** @override */
  async _impl_handleRequest(request, dispatch_unused) {
    const { headers, method } = request;
    const response = this.#response.adjustFor(
      method, headers, { conditional: true, range: true });

    return await request.respond(response);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    if (this.#response) {
      return;
    }

    const { body, contentType, cacheControl, etagOptions, filePath } = this.config;

    const response  = new Response();
    const headers   = response.headers;

    if (filePath) {
      const stats = await Statter.statOrNull(filePath);
      if (!stats || stats.isDirectory()) {
        throw new Error(`Not found or not a non-directory file: ${filePath}`);
      }
      response.setBodyBuffer(await fs.readFile(filePath));
      headers.set('content-type', contentType);
      headers.set('last-modified', HttpUtil.dateStringFromStatsMtime(stats));
      response.status = 200;
    } else if (body) {
      if (typeof body === 'string') {
        response.setBodyString(body, contentType);
      } else {
        response.setBodyBuffer(body);
        headers.set('content-type', contentType);
      }
      headers.set('last-modified', HttpUtil.dateStringFromMsec(Date.now()));
      response.status = 200;
    } else {
      response.setNoBody();
      response.status = 204; // "No Content."
    }

    if (cacheControl) {
      response.cacheControl = cacheControl;
    }

    if (etagOptions) {
      const etagGen = new EtagGenerator(etagOptions);
      const etag    = await etagGen.etagFromData(response.bodyBuffer ?? '');
      headers.set('etag', etag);
    }

    this.#response = response;
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // Nothing to do here.
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends ApplicationConfig {
    /**
     * @type {?string} Content type of the response, or `null` to infer it from
     * {@link #filePath}.
     */
    #contentType = null;

    /**
     * @type {?(string|Buffer)} Body contents of the response, or `null` to
     * use {@link #filePath}.
     */
    #body = null;

    /**
     * @type {?string} `cache-control` header to automatically include, or
     * `null` not to do that.
     */
    #cacheControl = null;

    /** @type {?object} Etag-generating options, or `null` not to do that. */
    #etagOptions = null;

    /**
     * @type {?string} Absolute path to a file for the body contents, or `null`
     * if {@link #body} is supplied directly.
     */
    #filePath = null;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const {
        body         = null,
        contentType  = null,
        cacheControl = null,
        etag         = null,
        filePath     = null
      } = config;

      if (body !== null) {
        if (!(body instanceof Buffer)) {
          MustBe.string(body);
        }

        if (contentType === null) {
          throw new Error('Must supply `contentType` if `body` is used.');
        } else if (filePath !== null) {
          throw new Error('Cannot specify both `body` and `filePath`.');
        }

        const isText = typeof body === 'string';

        this.#body        = body;
        this.#contentType = MimeTypes.typeFromExtensionOrType(contentType, { isText });
      } else if (filePath !== null) {
        this.#filePath    = Paths.checkAbsolutePath(filePath);
        this.#contentType = (contentType === null)
          ? MimeTypes.typeFromPathExtension(filePath)
          : MimeTypes.typeFromExtensionOrType(contentType);
      } else {
        // It's an empty body.
        if (contentType !== null) {
          throw new Error('Cannot supply `contentType` with empty body.');
        }
      }

      if ((cacheControl !== null) && (cacheControl !== false)) {
        this.#cacheControl = (typeof cacheControl === 'string')
          ? cacheControl
          : HttpUtil.cacheControlHeader(cacheControl);
        if (!this.#cacheControl) {
          throw new Error('Invalid `cacheControl` option.');
        }
      }

      if ((etag !== null) && (etag !== false)) {
        this.#etagOptions =
          EtagGenerator.expandOptions((etag === true) ? {} : etag);
      }
    }

    /**
     * @returns {?(string|Buffer)} Body contents of the response, or `null` to
     * use {@link #filePath}.
     */
    get body() {
      return this.#body;
    }

    /**
     * @returns {?string} `cache-control` header to automatically include, or
     * `null` not to do that.
     */
    get cacheControl() {
      return this.#cacheControl;
    }

    /**
     * @returns {?string} Content type of the response, or `null` to infer it
     * from {@link #filePath}.
     */
    get contentType() {
      return this.#contentType;
    }

    /** @returns {?object} Etag-generating options, or `null` not to do that. */
    get etagOptions() {
      return this.#etagOptions;
    }

    /**
     * @returns {?string} Absolute path to a file for the body contents, or
     * `null` if {@link #body} is supplied directly.
     */
    get filePath() {
      return this.#filePath;
    }
  };
}
