// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseWrangler } from '#p/BaseWrangler';

import express from 'express';

import * as http from 'http';

/**
 * Wrangler for `HttpServer`.
 */
export class HttpWrangler extends BaseWrangler {
  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    const server = http.createServer();
    const app = express();

    super(config, server, app);
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
