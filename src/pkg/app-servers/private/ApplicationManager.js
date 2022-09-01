// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationController } from '#p/ApplicationController';

import { JsonSchema, JsonSchemaUtil } from '@this/typey';

// Types referenced only in doc comments.
import { ServerController } from '#p/ServerController';

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
 *   application. Each mount point is of the form `//<hostname>/` or
 *   `//<hostname>/<base-path>/`, where `hostname` is the name of a configured
 *   host, and `base-path` is the absolute path which the application should
 *   respond to on that host.
 * * `{string} type` -- The type (class) of server. Several built-in types are
 *   available, and it is possible for clients of this system to define new
 *   types.
 * * In addition, each application type defines additional configuration to be
 *   included here.
 *
 * **Note:** Exactly one of `app` or `apps` must be present at the top level.
 */
export class ApplicationManager {
  /**
   * @type {Map<string, ApplicationController>} Map from each hostname /
   * wildcard to the controller that should be used for it.
   */
  #controllers = new Map();

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
   * Attaches an app to a server, making it a (presumed) single-app server.
   * TODO: This is scaffolding for the transition from single- to multi-app
   * support.
   *
   * @param {string} name Name of the application to serve.
   * @param {ServerController} serverController Server controller to attach to.
   */
  makeSingleApplicationServer(name, serverController) {
    const appController = this.#findController(name);

    if (appController === null) {
      throw new Error(`No such app: ${name}`);
    }

    const app = appController.app;
    const mounts = appController.mounts;

    if (mounts.length !== 1) {
      throw new Error(`No unique mount for application: ${appController.name}`);
    } else if (mounts[0].path.path.length !== 0) {
      throw new Error(`Only top-level mounts for now, not: ${mounts[0].path}`);
    }

    serverController.serverApp.use('/', app.middleware);
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
   * @returns {?ApplicationController} The associated information, or `null`
   *   if nothing suitable is found.
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
      $id: '/ApplicationManager',
      ... JsonSchemaUtil
        .singularOrPlural('app', 'apps', { $ref: '#/$defs/appItem' }),

      $defs: {
        appItem: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: {
              type: 'string',
              pattern: ApplicationController.NAME_PATTERN
            },
            type: {
              type: 'string',
              pattern: ApplicationController.TYPE_PATTERN
            }
          },
          ... JsonSchemaUtil
            .singularOrPlural('mount', 'mounts', { $ref: '#/$defs/mountItem' }),
        },
        mountItem: {
          type: 'string',
          pattern: ApplicationController.MOUNT_PATTERN
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
    const validator = new JsonSchema('Application Manager Configuration');
    this.addConfigSchemaTo(validator, true);

    const error = validator.validate(config);

    if (error) {
      error.log(console);
      error.throwError();
    }
  }
}
