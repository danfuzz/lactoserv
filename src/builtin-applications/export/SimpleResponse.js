// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { ApplicationConfig, Files } from '@this/app-config';
import { BaseApplication } from '@this/app-framework';
import { FsUtil } from '@this/fs-util';
import { IntfLogger } from '@this/loggy';
import { MimeTypes } from '@this/net-util';
import { MustBe } from '@this/typey';


/**
 * Simple response server. See docs for configuration object details.
 */
export class SimpleResponse extends BaseApplication {
  /** @type {?(Buffer|string)} Body contents of the response, if known. */
  #body = null;

  /** @type {?object} Send options to use, if known. */
  #sendOptions = null;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#body = config.body;
  }

  /** @override */
  async _impl_handleRequest(request, dispatch_unused) {
    return await request.sendContent(this.#body, SimpleResponse.#SEND_OPTIONS);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    if (!this.#body) {
      const filePath = this.config.filePath;

      if (!await FsUtil.fileExists(filePath)) {
        throw new Error(`Not found or not a file: ${filePath}`);
      }

      this.#body = await fs.readFile(filePath);
    }

    this.#sendOptions = {
      ...SimpleResponse.#SEND_OPTIONS,
      contentType: this.config.contentType
    };
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
    #contentType;

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
        if (contentType === null) {
          throw new Error('Must supply `contentType` if `body` is used.');
        } else if (filePath !== null) {
          throw new Error('Cannot specify both `body` and `filePath`.');
        }
      }

      this.#contentType = (contentType === null)
        ? MimeTypes.typeFromExtension(filePath)
        : MimeTypes.typeFromExtensionOrType(contentType);

      if (filePath !== null) {
        this.#filePath = Files.checkAbsolutePath(filePath);
      } else {
        if (!(body instanceof Buffer)) {
          MustBe.string(body);
        }
        this.#body = body;
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
