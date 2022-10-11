// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { HostController } from '@this/app-hosts';
import { ServiceController } from '@this/app-services';
import { JsonSchema, JsonSchemaUtil } from '@this/json';

import { ApplicationController } from '#x/ApplicationController';
import { ServerController } from '#p/ServerController';
import { ThisModule } from '#p/ThisModule';
import { Warehouse } from '#x/Warehouse';


/** @type {function(...*)} Logger for this class. */
const logger = ThisModule.logger.server;

/**
 * Manager for dealing with all the network-bound server endpoints of a system.
 * Configuration object details:
 *
 * * `{object} server` or `{object[]} servers`-- Objects, each of which
 *   represents endpoint information for a single server.
 *
 * Server info details:
 *
 * * `{string} name` -- Symbolic name of the server. This is used in application
 *   bindings to indicate which server(s) an application is served from.
 * * `{string} host` or `{string[]} hosts` -- Names of hosts which this server
 *   should accept as valid. Can include partial or complete wildcards.
 * * `{string} app` or `{string[]} apps` -- Names of apps which this server
 *   should provide access to.
 * * `{string} interface` -- Address of the physical interface that the server
 *   is to listen on. `*` indicates that all interfaces should be listened on.
 *   Note: `::` and `0.0.0.0` are not allowed; use `*` instead.
 * * `{int} port` -- Port number that the server is to listen on.
 * * `{string} protocol` -- Protocol that the server is to speak. Must be one of
 *   `http`, `http2`, or `https`.
 * * `{string} requestLogger` -- Optional name of the request loging service to
 *   inform of activity. If not specified, this server will not produce request
 *   logs.
 *
 * **Note:** Exactly one of `server` or `servers` must be present at the top
 * level.
 */
export class ServerManager {
  /** @type {Warehouse} The warehouse this instance is in. */
  #warehouse;

  /**
   * @type {Map<string, ServerController>} Map from each server name to the
   * {@link ServerController} object with that name.
   */
  #controllers = new Map();

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   * @param {Warehouse} warehouse The warehouse this instance is in.
   */
  constructor(config, warehouse) {
    ServerManager.#validateConfig(config);
    this.#warehouse = warehouse;

    const servers =
      JsonSchemaUtil.singularPluralCombo(config.server, config.servers);
    for (const server of servers) {
      this.#addControllerFor(server);
    }
  }

  /**
   * Finds the {@link ServerController} for a given server name.
   *
   * @param {string} name Server name to look for.
   * @returns {ServerController} The associated controller.
   * @throws {Error} Thrown if there is no controller with the given name.
   */
  findController(name) {
    const controller = this.#controllers.get(name);

    if (!controller) {
      throw new Error(`No such server: ${name}`);
    }

    return controller;
  }

  /**
   * Gets a list of all controllers managed by this instance.
   *
   * @returns {ServerController[]} All the controllers.
   */
  getAll() {
    return [...this.#controllers.values()];
  }

  /**
   * Constructs a {@link ServerController} based on the given information, and
   * adds a mapping to {@link #controllers} so it can be found.
   *
   * @param {object} serverItem Single server item from a configuration object.
   */
  #addControllerFor(serverItem) {
    const { requestLogger: rlName, app, apps, host, hosts } = serverItem;
    const { applicationManager, hostManager, serviceManager } = this.#warehouse;

    const hmSubset = hostManager
      ? hostManager.makeSubset(JsonSchemaUtil.singularPluralCombo(host, hosts))
      : null;
    const appMounts = applicationManager.makeMountList(
      JsonSchemaUtil.singularPluralCombo(app, apps));
    const requestLogger = rlName
      ? serviceManager.findController(rlName).service
      : null;

    const config = {
      ...serverItem,
      ...(hmSubset ? { hostManager: hmSubset } : null),
      ...(requestLogger ? { requestLogger } : null),
      appMounts
    };
    delete config.app;
    delete config.apps;
    delete config.host;
    delete config.hosts;

    const controller = new ServerController(config, logger);
    const name       = controller.name;

    logger.binding(name);

    if (this.#controllers.has(name)) {
      throw new Error(`Duplicate server name: ${name}`);
    }

    this.#controllers.set(name, controller);
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
  static addConfigSchemaTo(validator, main) {
    const schema = {
      $id: '/ServerManager',
      ... JsonSchemaUtil
        .singularOrPlural('server', 'servers', { $ref: '#/$defs/serverItem' }),

      $defs: {
        serverItem: {
          allOf: [
            {
              type: 'object',
              required: ['interface', 'name', 'port', 'protocol'],
              properties: {
                interface: {
                  type: 'string',
                  pattern: ServerController.INTERFACE_PATTERN
                },
                name: {
                  type: 'string',
                  pattern: ServerController.NAME_PATTERN
                },
                port: {
                  type: 'integer',
                  minimum: 1,
                  maximum: 65535
                },
                protocol: {
                  type: 'string',
                  enum: ['http', 'http2', 'https']
                },
                requestLogger: {
                  type: 'string',
                  pattern: ServiceController.NAME_PATTERN
                }
              }
            },
            JsonSchemaUtil
              .singularOrPlural('host', 'hosts', { $ref: '#/$defs/hostname' }),
            JsonSchemaUtil
              .singularOrPlural('app', 'apps', { $ref: '#/$defs/appName' })
          ]
        },
        appName: {
          type: 'string',
          pattern: ApplicationController.NAME_PATTERN
        },
        hostname: {
          type: 'string',
          pattern: HostController.HOSTNAME_PATTERN
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
    const validator = new JsonSchema();
    this.addConfigSchemaTo(validator, true);

    const error = validator.validate(config);

    if (error) {
      error.logTo(console);
      error.throwError();
    }
  }
}
