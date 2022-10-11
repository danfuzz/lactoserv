// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonSchema, JsonSchemaUtil } from '@this/json';
import { Loggy } from '@this/loggy';

import { ServiceController } from '#x/ServiceController';


/** @type {function(...*)} Logger for this class. */
const logger = Loggy.loggerFor('service');

/**
 * Manager for dealing with all the high-level system services that are running
 * or could be run in the system. Configuration object details:
 *
 * * `{object} service` or `{object[]} services` -- Objects which each
 *   represents information for a single service.
 *
 * Service info details:
 *
 * * `{string} name` -- Symbolic name of the service. This is used in logging
 *   and messaging.
 * * `{string} type` -- The type (class) of service. Several built-in types are
 *   available, and it is possible for clients of this system to define new
 *   types.
 * * In addition, each service type defines additional configuration to be
 *   included here.
 *
 * **Note:** Exactly one of `service` or `services` must be present at the top
 * level.
 */
export class ServiceManager {
  /**
   * @type {Map<string, ServiceController>} Map from each service name to the
   * controller that should be used for it.
   */
  #controllers = new Map();

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    ServiceManager.#validateConfig(config);

    const services = JsonSchemaUtil.singularPluralCombo(config.service, config.services);
    for (const service of services) {
      this.#addControllerFor(service);
    }
  }

  /**
   * Gets a list of all controllers managed by this instance, optionally
   * filtered to only be those of a particular class or (string) type.
   *
   * @param {?string|function(new:BaseService)} [type = null] Class or (string)
   *   type to restrict results to, or `null` just to get everything.
   * @returns {ServiceController[]} All the matching controllers.
   */
  getAll(type = null) {
    const cls = (typeof type === 'string')
      ? ServiceFactory.classFromType(type)
      : type;

    const result = [];
    for (const controller of this.#controllers.values()) {
      if ((cls === null) || (controller instanceof cls)) {
        result.push(controller);
      }
    }

    return result;
  }

  /**
   * Constructs a {@link ServiceController} based on the given information,
   * and adds a mapping to {@link #controllers} so it can be found.
   *
   * @param {object} serviceItem Single service item from a configuration
   * object.
   */
  #addControllerFor(serviceItem) {
    const controller = new ServiceController(serviceItem, logger);
    const name       = controller.name;

    logger.binding(name);

    if (this.#controllers.has(name)) {
      throw new Error(`Duplicate service: ${name}`);
    }

    this.#controllers.set(name, controller);
  }

  /**
   * Finds the {@link ServiceController} with the given name.
   *
   * @param {string} name Service name to look for.
   * @returns {?ServiceController} The associated controller, or `null` if there
   *   is no such service.
   */
  #findController(name) {
    const controller = this.#controllers.get(name);
    return controller ?? null;
  }


  //
  // Static members
  //

  /**
   * Adds the config schema for this class to the given validator.
   *
   * @param {JsonSchema} validator The validator to add to.
   * @param {boolean} [main = false] Is this the main schema?
   */
  static addConfigSchemaTo(validator, main = false) {
    const schema = {
      $id: '/ServiceManager',
      ... JsonSchemaUtil
        .singularOrPlural('service', 'services', { $ref: '#/$defs/serviceItem' }),

      $defs: {
        serviceItem: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: {
              type: 'string',
              pattern: ServiceController.NAME_PATTERN
            },
            type: {
              type: 'string',
              pattern: ServiceController.TYPE_PATTERN
            }
          }
        }
      }
    };

    if (main) {
      validator.addMainSchema(schema);
    } else {
      validator.addSchema(schema);
    }
  }

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const validator = new JsonSchema('Service Manager Configuration');
    this.addConfigSchemaTo(validator, true);

    const error = validator.validate(config);

    if (error) {
      error.logTo(console);
      error.throwError();
    }
  }
}
