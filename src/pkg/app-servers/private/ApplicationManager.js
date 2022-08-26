// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ActualServer } from '#p/ActualServer';
import { ApplicationController } from '#p/ApplicationController';

import { Validator } from 'jsonschema';

/**
 * Manager for dealing with all the high-level applications that are running or
 * to be run in the system. Configuration object details:
 *
 * * `{object} app` -- Object representing information for a single application.
 * * `{object[]} apps` -- Array of application information objects.
 *
 * Application info details:
 *
 * * `{string} name` -- Symbolic name of the application. This is used in
 *   logging and messaging.
 * * `{string} mount` or `{string[]} mounts` -- Mount points for the
 *   application. Each mount point is of the form `//<server-name>/` or
 *   `//<server-name>/<base-path>/`, where `server-name` is the name of a
 *   configured server, and `base-path` is the absolute path which the
 *   application should respond to.
 * * `{string} type` -- The type (class) of server. Several built-in types are
 *   available, and it is possible for clients of this system to define new
 *   types.
 * * In addition, each application type defines additional configuration to be
 *   included here.
 *
 * **Note:** Exactly one of `app` or `apps` must be present at the top level.
 */
export class ApplicationManager {
  /** {Map<string, ServerInfo>} Map from each hostname / wildcard to the
   * {@link ServerInfo} object that should be used for it. */
  #controllers = new Map();

  /**
   * Adds the config schema for this class to the given validator.
   *
   * @param {Validator} validator The validator to add to.
   */
  static addConfigSchemaTo(validator) {
    // Allows alphanumeric strings that contain dashes, but don't start or end
    // with a dash.
    const nameComponent = '(?!-)[-a-zA-Z0-9]+(?<!-)';
    const namePattern = `^${nameComponent}$`;
    const mountPattern = `//${nameComponent}(/${nameComponent})*/`

    const schema = {
      title: 'application-config',
      oneOf: [
        {
          title: 'app',
          type: 'object',
          required: ['app'],
          properties: {
            app: { $ref: '#/$defs/appItem' }
          }
        },
        {
          title: 'apps',
          type: 'object',
          required: ['apps'],
          properties: {
            apps: {
              type: 'array',
              uniqueItems: true,
              items: { $ref: '#/$defs/appItem' }
            }
          }
        }
      ],

      $defs: {
        appItem: {
          title: 'app-item',
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: {
              type: 'string',
              pattern: namePattern
            },
            type: {
              type: 'string',
              pattern: namePattern
            }
          },
          oneOf: [
            {
              type: 'object',
              required: ['mount'],
              properties: {
                mount: {
                  type: 'string',
                  pattern: mountPattern
                }
              }
            },
            {
              type: 'object',
              required: ['mounts'],
              properties: {
                mounts: {
                  type: 'array',
                  uniqueItems: true,
                  items: {
                    type: 'string',
                    pattern: mountPattern
                  }
                }
              }
            }
          ]
        }
      }
    };

    validator.addSchema(schema, '/ApplicationManager');
  }

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    ApplicationManager.#validateConfig(config);

    if (config.app) {
      this.#addControllerFor(config.app);
    }

    if (config.apps) {
      for (const app of config.apps) {
        this.#addControllerFor(app);
      }
    }
  }

  /**
   * Creates a single-app server. TODO: This is scaffolding for the transition
   * from single- to multi-app support.
   *
   * @param {string} name Name of the application to serve.
   * @param {Warehouse} warehouse Warehouse of configured parts.
   * @returns {ActualServer} Appropriately-constructed instance.
   */
  makeSingleApplicationServer(name, warehouse) {
    const controller = this.#findController(name);

    if (controller === null) {
      throw new Error(`No such app: ${name}`);
    }

    const app = controller.app;
    const mounts = controller.mounts;

    if (mounts.length !== 1) {
      throw new Error(`No unique mount for application: ${controller.name}`);
    } else if (mounts[0].path !== '/') {
      throw new Error(`Only top-level mounts for now, not: ${mounts[0].path}`);
    }

    const serverName = mounts[0].server;
    const serverConfig = warehouse.serverManager.findConfig(serverName);

    const actual = new ActualServer(warehouse.hostManager, serverConfig);
    actual.app.use('/', app.middleware);

    return actual;
  }

  /**
   * Constructs a {@link ApplicationController} based on the given information,
   * and adds a mapping to {@link #controllers} so it can be found.
   *
   * @param {object} appItem Single application item from a configuration
   * object.
   */
  #addControllerFor(appItem) {
    const controller = new ApplicationController(appItem);
    const name = controller.name;

    console.log(`Binding application ${name}.`);

    if (this.#controllers.has(name)) {
      throw new Error(`Duplicate application: ${name}`);
    }

    this.#controllers.set(name, controller);
  }

  /**
   * Finds the {@link ApplicationController} for a given application name.
   *
   * @param {string} name Application name to look for.
   * @returns {ApplicationController|null} The associated information, or `null`
   *   if nothing suitable is found.
   */
  #findController(name) {
    const controller = this.#controllers.get(name);
    return controller ?? null;
  }

  /**
   * Validates the given configuration object.
   *
   * @param {object} config Configuration object.
   */
  static #validateConfig(config) {
    const v = new Validator();
    this.addConfigSchemaTo(v);

    const result = v.validate(config, { $ref: '/ApplicationManager' });
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
