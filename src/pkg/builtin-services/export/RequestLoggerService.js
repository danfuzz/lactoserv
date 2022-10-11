// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseService, ServiceController } from '@this/app-services';
import { JsonSchema } from '@this/json';


/**
 * Service which writes the access log to the filesystem. Configuration object
 * details:
 *
 * * `{string} directory` -- Absolute path to the directory to write to.
 * * `{string} baseName` -- Base file name for the log files.
 */
export class RequestLoggerService extends BaseService {
  /**
   * Constructs an instance.
   *
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(controller) {
    super(controller);

    const config = controller.config;
    RequestLoggerService.#validateConfig(config);
    // TODO: Implement this.
  }

  /** @override */
  async start() {
    // TODO
  }

  /** @override */
  async stop() {
    // TODO
  }


  //
  // Static members
  //

  /** @returns {string} Service type as used in configuration objects. */
  static get TYPE() {
    return 'request-logger';
  }

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const validator = new JsonSchema('Request Logger Configuration');

    const namePattern = '^[^/]+$';
    const pathPattern =
      '^' +
      '(?!.*/[.]{1,2}/)' + // No dot or double-dot internal component.
      '(?!.*/[.]{1,2}$)' + // No dot or double-dot final component.
      '(?!.*//)' +         // No empty components.
      '(?!.*/$)' +         // No slash at the end.
      '/[^/]';             // Starts with a slash. Has at least one component.

    validator.addMainSchema({
      $id: '/RequestLoggerService',
      type: 'object',
      required: ['baseName', 'directory'],
      properties: {
        baseName: {
          type: 'string',
          pattern: namePattern
        },
        directory: {
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
