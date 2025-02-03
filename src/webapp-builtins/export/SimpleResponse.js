// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { WallClock } from '@this/clocky';
import { Paths, Statter } from '@this/fs-util';
import { EtagGenerator, FullResponse, HttpUtil, MimeTypes, StatusResponse }
  from '@this/net-util';
import { AskIf, MustBe } from '@this/typey';
import { BaseApplication } from '@this/webapp-core';


/**
 * Simple response server. See docs for configuration object details.
 */
export class SimpleResponse extends BaseApplication {
  /**
   * Allow response adjustment?
   *
   * @type {boolean}
   */
  #allowAdjustment = true;

  /**
   * Response template to clone for all actual responses.
   *
   * @type {FullResponse}
   */
  #response = null;

  // Note: The default contructor is fine for this class.

  /** @override */
  async _impl_handleRequest(request, dispatch_unused) {
    const { headers, method } = request;
    const response            = this.#response;

    if (!request.isGetOrHead()) {
      return StatusResponse.FORBIDDEN;
    } else if (this.#allowAdjustment) {
      return response.adjustFor(method, headers, { conditional: true, range: true });
    } else {
      return response;
    }
  }

  /** @override */
  async _impl_start() {
    if (this.#response) {
      return;
    }

    const {
      body, contentType, cacheControl, etag, filePath, statusCode
    } = this.config;

    const response  = new FullResponse();
    const headers   = response.headers;

    if (filePath) {
      const stats = await Statter.statElseNull(filePath);
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
      headers.set('last-modified', WallClock.now().toHttpString());
      response.status = 200;
    } else {
      response.setNoBody();
      response.status = 204; // "No Content."
    }

    if (cacheControl) {
      response.cacheControl = cacheControl;
    }

    if (etag) {
      const etagGen    = new EtagGenerator(etag);
      const etagHeader = await etagGen.etagFromData(response.bodyBuffer ?? '');
      headers.set('etag', etagHeader);
    }

    if (statusCode !== null) {
      response.status = statusCode;
      this.#allowAdjustment = false;
    }

    this.#response = response;

    await super._impl_start();
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return class Config extends super.prototype.constructor.configClass {
      // @defaultConstructor

      /**
       * Body contents of the response, or `null` to use `filePath` if present
       * _or_ respond with no body.
       *
       * @param {?string|Buffer} [value] Proposed configuration value. Default
       *   `null`.
       * @returns {?string|Buffer} Accepted configuration value.
       */
      _config_body(value = null) {
        if (value === null) {
          return value;
        } else if ((value instanceof Buffer) || (typeof value === 'string')) {
          return value;
        } else {
          throw new Error('Invalid `body` option.');
        }
      }

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
       * Content type of the response, or `null` to infer it from `filePath`.
       *
       * @param {?string} [value] Proposed configuration value. Default `null`.
       * @returns {?string} Accepted configuration value.
       */
      _config_contentType(value = null) {
        // Note: Conversion is done in `_impl_validate()`, because we don't know
        // what options to pass to the MIME type converter until we see if we
        // have `body` or `filePath`.
        return (value === null) ? null : MustBe.string(value);
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

      /**
       * Absolute path to a file for the body contents, or `null` if `body` is
       * being used _or_ if this is to be a no-body response.
       *
       * @param {?string} [value] Proposed configuration value. Default `null`.
       * @returns {?string} Accepted configuration value.
       */
      _config_filePath(value = null) {
        return (value === null)
          ? null
          : Paths.mustBeAbsolutePath(value);
      }

      /**
       * Predefined status code of the response, or `null` to use the most
       * appropriate "success" status code (usually but not always `200`).
       *
       * @param {?number} [value] Proposed configuration value. Default `null`.
       * @returns {?number} Accepted configuration value.
       */
      _config_statusCode(value = null) {
        if (value === null) {
          return null;
        }

        return MustBe.number(value, {
          safeInteger:  true,
          minInclusive: 100,
          maxInclusive: 599
        });
      }

      /** @override */
      _impl_validate(config) {
        const { body, filePath } = config;
        let   { contentType }    = config;

        if (body !== null) {
          if (contentType === null) {
            throw new Error('Must specify `contentType` if `body` is used.');
          } else if (filePath !== null) {
            throw new Error('Cannot specify both `body` and `filePath`.');
          }

          contentType = MimeTypes.typeFromExtensionOrType(contentType, {
            isText: (typeof body === 'string')
          });
        } else if (filePath !== null) {
          contentType = (contentType === null)
            ? MimeTypes.typeFromPathExtension(filePath)
            : MimeTypes.typeFromExtensionOrType(contentType);
        } else {
          // It's a no-body response.
          if (contentType !== null) {
            throw new Error('Cannot specify `contentType` on a no-body response.');
          }
        }

        return super._impl_validate({ ...config, contentType });
      }
    };
  }
}
