// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseApplication } from '#p/BaseApplication';

import express from 'express';
import { Validator } from 'jsonschema';

/**
 * Static content server. Configuration object details:
 *
 * * `{string} assetsPath` -- Absolute path to the base directory for the
 *   static assets.
 */
export class StaticApplication extends BaseApplication {
  /* {function} "Middleware" handler function for this instance. */
  #handleRequest;

  /** @returns {string} Application type as used in configuration objects. */
  static get TYPE() {
    return 'static-server';
  }

  /**
   * Constructs an instance.
   *
   * @param {object} config Application-specific configuration object.
   */
  constructor(config) {
    super();

    StaticApplication.#validateConfig(config);
    this.#handleRequest = StaticApplication.#makeHandler(config);
  }

  /** Per superclass requirement. */
  handleRequest(req, res, next) {
    this.#handleRequest(req, res, next);
  }

  /**
   * Makes a request handler function for an instance of this class.
   *
   * @param {object} config Configuration object.
   * @returns {Function} The middleware function.
   */
  static #makeHandler(config) {
    const assetsPath = config.assetsPath;
    return express.static(assetsPath);
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
      required: ['assetsPath'],
      properties: {
        assetsPath: {
          type: 'string',
          pattern: pathPattern
        }
      }
    };

    const result = v.validate(config, schema);
    const errors = result.errors;

    if (errors.length !== 0) {
      console.log('Configuration error%s:', (errors.length === 1) ? '' : 's');
      for (const e of errors) {
        console.log('  %s', e.stack);
      }

      throw new Error('Invalid configuration.');
    }
  }
}
