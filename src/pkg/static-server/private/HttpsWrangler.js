// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseWrangler } from '#p/BaseWrangler';

import express from 'express';

import * as https from 'https';

/**
 * Wrangler for `HttpsServer`.
 */
export class HttpsWrangler extends BaseWrangler {
  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   * @param {ActualServer} actual Controlling instance.
   */
  constructor(config, actual) {
    super(config, actual);
  }

  /** Per superclass requirement. */
  createApplication() {
    return express();
  }

  /** Per superclass requirement. */
  createServer() {
    const config = this.actual.config;
    const serverOptions = {
      key: config.key,
      cert: config.cert
    }

    return https.createServer(serverOptions);
  }

  /** Per superclass requirement. */
  async protocolStart() {
    // Nothing to do in this case.
  }

  /** Per superclass requirement. */
  async protocolStop() {
    // Nothing to do in this case.
  }

  /** Per superclass requirement. */
  async protocolWhenStopped() {
    // Nothing to do in this case.
  }
}
