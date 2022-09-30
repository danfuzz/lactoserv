// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TcpWrangler } from '#p/TcpWrangler';

import express from 'express';

import * as http from 'node:http';

/**
 * Wrangler for `HttpServer`.
 */
export class HttpWrangler extends TcpWrangler {
  // Note: Default constructor is fine here.

  /** @override */
  createApplication() {
    return express();
  }

  /** @override */
  createServer(certOptions_unused) {
    return http.createServer();
  }

  /** @override */
  async protocolStart() {
    // Nothing to do in this case.
  }

  /** @override */
  async protocolStop() {
    // Nothing to do in this case.
  }

  /** @override */
  async protocolWhenStopped() {
    // Nothing to do in this case.
  }

  /** @override */
  usesCertificates() {
    return false;
  }
}
