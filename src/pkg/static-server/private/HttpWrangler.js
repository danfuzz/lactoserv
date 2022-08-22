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
   * @param {ActualServer} actual Controlling instance.
   */
  constructor(actual) {
    super(actual);
  }

  /** Per superclass requirement. */
  createApplication() {
    return express();
  }

  /** Per superclass requirement. */
  createServer() {
    return http.createServer();
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
