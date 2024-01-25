// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { ApplicationConfig, Files } from '@this/app-config';
import { BaseApplication } from '@this/app-framework';
import { FsUtil } from '@this/fs-util';
import { MimeTypes } from '@this/net-util';
import { MustBe } from '@this/typey';


/**
 * Simple response server. See docs for configuration object details.
 */
export class SimpleResponse extends BaseApplication {
  /**
   * @type {?function(Request): Promise} Function to call to issue a response.
   */
  #respondFunc = null;

  // Note: The default contructor is fine for this class.

  /** @override */
  async _impl_handleRequest(request, dispatch_unused) {
    return await this.#respondFunc(request);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    if (this.#respondFunc) {
      return;
    }

    const { body, contentType, filePath } = this.config;
    let finalBody = body;

    const sendOptions = SimpleResponse.#SEND_OPTIONS;

    if (filePath) {
      if (!await FsUtil.fileExists(filePath)) {
        throw new Error(`Not found or not a non-directory file: ${filePath}`);
      }

      finalBody = await fs.readFile(filePath);
    }

    if (finalBody) {
      this.#respondFunc = (request) => {
        request.sendContent(finalBody, contentType, sendOptions);
      };
    } else {
      this.#respondFunc = (request) => {
        request.sendEmptyResponse(sendOptions);
      };
    }
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // Nothing to do here.
  }


  //
  // Static members
  //

  /** @type {object} File sending/serving configuration options. */
  static #SEND_OPTIONS = Object.freeze({
    maxAgeMsec: 5 * 60 * 1000 // 5 minutes.
  });

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

      const { body = null, contentType = null, filePath = null } = config;

      if (body !== null) {
        if (!(body instanceof Buffer)) {
          MustBe.string(body);
        }

        if (contentType === null) {
          throw new Error('Must supply `contentType` if `body` is used.');
        } else if (filePath !== null) {
          throw new Error('Cannot specify both `body` and `filePath`.');
        }

        this.#body        = body;
        this.#contentType = MimeTypes.typeFromExtensionOrType(contentType);
      } else if (filePath !== null) {
        this.#filePath    = Files.checkAbsolutePath(filePath);
        this.#contentType = (contentType === null)
          ? MimeTypes.typeFromExtension(filePath)
          : MimeTypes.typeFromExtensionOrType(contentType);
      } else {
        // It's an empty body.
        if (contentType !== null) {
          throw new Error('Cannot supply `contentType` with empty body.');
        }
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
     * @returns {?string} Content type of the response, or `null` to infer it
     * from {@link #filePath}.
     */
    get contentType() {
      return this.#contentType;
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
