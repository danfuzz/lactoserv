// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { HostManager } from '#p/HostManager';
import { ServerController } from '#p/ServerController';

import { JsonSchema } from '@this/typey';


/**
 * Manager for dealing with all the network-bound server endpoints of a system.
 * Configuration object details:
 *
 * * `{object} server` -- Object representing endpoint information for a single
 *   server.
 * * `{object[]} servers` -- Array of server information objects.
 *
 * Server info details:
 *
 * * `{string} name` -- Symbolic name of the server. This is used in application
 *   bindings to indicate which server(s) an application is served from.
 * * `{string} host` or `{string[]} hosts` -- Names of hosts which this server
 *   should accept as valid. Can include partial or complete wildcards.
 * * `{string} interface` -- Address of the physical interface that the server
 *   is to listen on. `*` indicates that all interfaces should be listened on.
 *   Note: `::` and `0.0.0.0` are not allowed; use `*` instead.
 * * `{int} port` -- Port number that the server is to listen on.
 * * `{string} protocol` -- Protocol that the server is to speak. Must be one of
 *   `http`, `http2`, or `https`.
 *
 * **Note:** Exactly one of `server` or `servers` must be present at the top
 * level.
 */
export class ServerManager {
  /**
   * {Map<string, ServerController>} Map from each hostname / wildcard to the
   * {@link ServerController} object that should be used for it.
   */
  #controllers = new Map();

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   * @param {HostManager} hostManager Host / certificate manager.
   */
  constructor(config, hostManager) {
    ServerManager.#validateConfig(config);

    if (config.server) {
      this.#addControllerFor(config.server, hostManager);
    }

    if (config.servers) {
      for (const server of config.servers) {
        this.#addControllerFor(server, hostManager);
      }
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
   * Constructs a {@link ServerController} based on the given information, and
   * adds a mapping to {@link #controllers} so it can be found.
   *
   * @param {object} serverItem Single server item from a configuration object.
   * @param {HostManager} hostManager Host / certificate manager.
   */
  #addControllerFor(serverItem, hostManager) {
    const hostArray = serverItem.host ? [serverItem.host] : [];
    const hostsArray = serverItem.hosts ?? [];

    const config = {
      ...serverItem,
      hostManager: hostManager.makeSubset([...hostArray, ...hostsArray])
    };
    delete config.host;
    delete config.hosts;

    const controller = new ServerController(config);
    const name = controller.name;

    console.log(`Binding server ${name}.`);

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
    // Allows alphanumeric strings that contain dashes, but don't start or end
    // with a dash.
    const serverNamePattern = '^(?!-)[-a-zA-Z0-9]+(?<!-)$';

    const interfacePattern =
      '^(' +
      '[*]' +                   // The one allowed "any" address.
      '|' +
      '(?!::|(0+[.]){0,3}0+)' + // No IPv4 or IPv6 "any" addresses.
      '(?![-.])' +              // Doesn't start with `-` or `.`.
      '[-.:a-zA-Z0-9]+' +       // A bit over-permissive here.
      '(?<![-.])' +             // Doesn't end with `-` or `.`.
      ')$';

    const schema = {
      $id: '/ServerManager',
      oneOf: [
        {
          title: 'server',
          type: 'object',
          required: ['server'],
          properties: {
            server: { $ref: '#/$defs/serverItem' }
          }
        },
        {
          title: 'servers',
          type: 'object',
          required: ['servers'],
          properties: {
            servers: {
              type: 'array',
              uniqueItems: true,
              items: { $ref: '#/$defs/serverItem' }
            }
          }
        }
      ],

      $defs: {
        serverItem: {
          title: 'server-item',
          type: 'object',
          required: ['interface', 'name', 'port', 'protocol'],
          properties: {
            interface: {
              type: 'string',
              pattern: interfacePattern
            },
            name: {
              type: 'string',
              pattern: serverNamePattern
            },
            port: {
              type: 'integer',
              minimum: 1,
              maximum: 65535
            },
            protocol: {
              type: 'string',
              enum: ['http', 'http2', 'https']
            }
          },
          oneOf: [
            {
              type: 'object',
              required: ['host'],
              properties: {
                host: { $ref: '#/$defs/hostname' }
              }
            },
            {
              title: 'servers',
              type: 'object',
              required: ['hosts'],
              properties: {
                servers: {
                  type: 'array',
                  uniqueItems: true,
                  items: { $ref: '#/$defs/hostname' }
                }
              }
            }
          ]
        },
        hostname: {
          type: 'string',
          pattern: HostManager.HOSTNAME_PATTERN
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
      error.log(console);
      error.throwError();
    }
  }
}
