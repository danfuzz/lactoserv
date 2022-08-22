// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';
import { BaseExportedServer } from '#p/BaseExportedServer';
import { PROTECTED_ACCESS } from '#p/PROTECTED_ACCESS';

import express from 'express';
import { Validator } from 'jsonschema';

/**
 * Static content server.
 */
export class StaticServer extends BaseExportedServer {
  /**
   * Constructs an instance. Configuration object details:
   *
   * * `{string} assetsPath` -- Base directory for the static assets.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    super(config);
    StaticServer.#validateConfig(config);

    this.#addRoutes(config.assetsPath);
  }

  /**
   * Adds routes to the application instance.
   *
   * @param {string} assetsPath Base directory for the static assets.
   */
  #addRoutes(assetsPath) {
    const actual = this.getActual(PROTECTED_ACCESS)
    const app = actual.app;

    app.use('/', express.static(assetsPath))
  }

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const v = new Validator();

    const schema = {
      title: 'static-server',
      type: 'object',
      required: ['what', 'assetsPath'],
      properties: {
        what: {
          const: 'static-server'
        },
        assetsPath: {
          type: 'string'
        }
      }
    };

    const result = v.validate(config, schema);
    const errors = result.errors;

    if (errors.length != 0) {
      console.log('Configuration error%s:', (errors.length == 1) ? '' : 's');
      for (const e of errors) {
        console.log('  %s', e.stack);
      }

      throw new Error('Invalid configuration.');
    }
  }
}
