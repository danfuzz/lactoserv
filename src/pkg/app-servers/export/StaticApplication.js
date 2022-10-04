// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import express from 'express';

import { JsonSchema } from '@this/json';

import { BaseApplication } from '#p/BaseApplication';


/**
 * Static content server. Configuration object details:
 *
 * * `{string} assetsPath` -- Absolute path to the base directory for the
 *   static assets.
 */
export class StaticApplication extends BaseApplication {
  /* @type {function} "Middleware" handler function for this instance. */
  #handleRequest;

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

  /** @override */
  handleRequest(req, res, next) {
    this.#handleRequest(req, res, next);
  }


  //
  // Static members
  //

  /** @returns {string} Application type as used in configuration objects. */
  static get TYPE() {
    return 'static-server';
  }

  /**
   * Makes a request handler function for an instance of this class.
   *
   * @param {object} config Configuration object.
   * @returns {function(...*)} The middleware function.
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
    const validator = new JsonSchema('Static Server Configuration');

    const pathPattern =
      '^' +
      '(?!.*/[.]{1,2}/)' + // No dot or double-dot internal component.
      '(?!.*/[.]{1,2}$)' + // No dot or double-dot final component.
      '(?!.*//)' +         // No empty components.
      '(?!.*/$)' +         // No slash at the end.
      '/[^/]';             // Starts with a slash. Has at least one component.

    validator.addMainSchema({
      $id: '/StaticApplication',
      type: 'object',
      required: ['assetsPath'],
      properties: {
        assetsPath: {
          type: 'string',
          pattern: pathPattern
        }
      }
    });

    const error = validator.validate(config);

    if (error) {
      error.logTo(console);
      error.throwError();
    }
  }
}
