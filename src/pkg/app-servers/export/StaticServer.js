// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';
import { BaseExportedServer } from '#p/BaseExportedServer';
import { PROTECTED_ACCESS } from '#p/PROTECTED_ACCESS';
import { Warehouse } from '#x/Warehouse';

import express from 'express';
import { Validator } from 'jsonschema';

/**
 * Static content server. Configuration object details:
 *
 * * `{string} assetsPath` -- Absolute path to the base directory for the
 *   static assets.
 */
export class StaticServer extends BaseExportedServer {
  /**
   * Constructs an instance.
   *
   * @param {Warehouse} warehouse Warehouse of configured pieces.
   */
  constructor(warehouse) {
    super(warehouse);

    const config = warehouse.config;
    StaticServer.#validateConfig(config);

    this.#addRoutes(config.assetsPath);
  }

  /**
   * Adds routes to the application instance.
   *
   * @param {string} assetsPath Base directory for the static assets.
   */
  #addRoutes(assetsPath) {
    const actual = this.getActual(PROTECTED_ACCESS);
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

    const pathPattern =
      '^' +
      '(?!.*/[.]{1,2}/)' + // No dot or double-dot internal component.
      '(?!.*/[.]{1,2}$)' + // No dot or double-dot final component.
      '(?!.*//)' +         // No empty components.
      '(?!.*/$)' +         // No slash at the end.
      '/[^/]';             // Starts with a slash. Has at least one component.

    const schema = {
      title: 'static-server',
      type: 'object',
      required: ['what', 'assetsPath'],
      properties: {
        what: {
          const: 'static-server'
        },
        assetsPath: {
          type: 'string',
          pattern: pathPattern
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
