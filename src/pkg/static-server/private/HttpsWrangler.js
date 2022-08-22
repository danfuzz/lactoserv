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
   */
  constructor(config, actual) {
    const serverOptions = {
      key: config.key,
      cert: config.cert
    }

    const server = https.createServer(config);
    const app = express();

    super(config, actual, server, app);
  }

  /** Per superclass requirement. */
  async sub_start() {
    // Nothing to do in this case.
  }

  /** Per superclass requirement. */
  async sub_stop() {
    // Nothing to do in this case.
  }

  /** Per superclass requirement. */
  async sub_whenStopped() {
    // Nothing to do in this case.
  }
}
