// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationFactory } from '#p/ApplicationFactory';

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
  #infos = new Map();

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
      this.#addInfoFor(config.app);
    }

    if (config.apps) {
      for (const app of config.app) {
        this.#addInfoFor(app);
      }
    }
  }

  /**
   * Creates a single-app server. TODO: This is scaffolding for the transition
   * from single- to multi-app support.
   *
   * @param {string} name Name of the application to serve.
   * @param {Warehouse} warehouse Warehouse of configured parts.
   * @returns {BaseApplication} Appropriately-constructed instance.
   */
  makeSingleApplicationServer(name, warehouse) {
    const info = this.#findInfo(name);

    if (info === null) {
      throw new Error(`No such app: ${name}`);
    }

    return ApplicationFactory.forType(info.type, info, warehouse);
  }

  /**
   * Constructs a {@link ApplicationInfo} based on the given information, and
   * adds a mapping to {@link #infos} so it can be found.
   *
   * @param {object} appItem Single application item from a configuration object.
   */
  #addInfoFor(appItem) {
    const info = new ApplicationInfo(appItem);
    const name = info.name;

    console.log(`Binding application ${name}.`);

    if (this.#infos.has(name)) {
      throw new Error(`Duplicate application: ${name}`);
    }

    this.#infos.set(name, info);
  }

  /**
   * Finds the {@link ApplicationInfo} for a given application name.
   *
   * @param {string} name Application name to look for.
   * @returns {ApplicationInfo|null} The associated information, or `null` if
   *   nothing suitable is found.
   */
  #findInfo(name) {
    const info = this.#infos.get(name);
    return info ?? null;
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

/**
 * Holder for a single set of application information.
 */
class ApplicationInfo {
  /** {string} Application name. */
  #name;

  /** {string} Application type. */
  #type;

  /** {object[]} Mount points, as an array of pairs of `{server, path}`. */
  #mounts;

  /** {object} Application-specific configuration. */
  #extraConfig;

  /**
   * Constructs an insance.
   *
   * @param {object} appConfig Server information configuration item.
   */
  constructor(appConfig) {
    this.#name      = appConfig.name;
    this.#type      = appConfig.type;

    const mountArray = appConfig.mount ? [appConfig.mount] : [];
    const mountsArray = appConfig.mounts ?? [];
    this.#mounts = Object.freeze(
      [...mountArray, ...mountsArray].map((mount) => ApplicationInfo.#parseMount(mount))
    );

    const extraConfig = {...appConfig};
    delete extraConfig.name;
    delete extraConfig.type;
    delete extraConfig.mount;
    delete extraConfig.mounts;
    this.#extraConfig = extraConfig;
  }

  /** {string} Application name. */
  get name() {
    return this.#name;
  }

  /** {string} Application type. */
  get type() {
    return this.#type;
  }

  /** {object[]} Mount points, as an array of pairs of `{server, path}`. */
  get mounts() {
    return this.#mounts;
  }

  /** {object} Application-specific configuration. */
  get extraConfig() {
    return this.#extraConfig;
  }

  /**
   * Parses a mount point into its two components.
   *
   * @param {string} mount Mount point.
   * @returns {object} Components thereof.
   */
  static #parseMount(mount) {
    const result = /^[/][/](?<server>[^/]+)(?<path>[/].*)$/.exec(mount);
    if (!result) {
      throw new Error(`Strange mount point: ${mount}`);
    }

    return Object.freeze({
      server: result.groups.server,
      path:   result.groups.path
    })
  }
}
