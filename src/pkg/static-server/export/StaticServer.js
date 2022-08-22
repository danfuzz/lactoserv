// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';
import { BaseExportedServer } from '#p/BaseExportedServer';
import { PROTECTED_ACCESS } from '#p/PROTECTED_ACCESS';

import express from 'express';

import * as url from 'url';

/**
 * Static content server.
 */
export class StaticServer extends BaseExportedServer {
  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    super(config);
    this.#addRoutes();
  }

  /**
   * Adds routes to the application instance.
   */
  #addRoutes() {
    const actual = this.getActual(PROTECTED_ACCESS)
    const app = actual.app;

    // TODO: Way more stuff. For now, just serve some static files.
    const assetsDir = url.fileURLToPath(new URL('../assets', import.meta.url));
    app.use('/', express.static(assetsDir))
  }
}
