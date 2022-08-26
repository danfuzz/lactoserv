// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseWrangler } from '#p/BaseWrangler';

import express from 'express';

import * as http from 'http';

/**
 * Wrangler for `HttpServer`.
 */
export class HttpWrangler extends BaseWrangler {
  // Note: Default constructor is fine here.

  /** Per superclass requirement. */
  createApplication() {
    return express();
  }

  /** Per superclass requirement. */
  createServer(hostManager_unused) {
    return http.createServer();
  }

  /** Per superclass requirement. */
  async protocolStart(server_unused) {
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
