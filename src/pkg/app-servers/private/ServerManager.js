// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Validator } from 'jsonschema';

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
 * * `{string} interface` -- Address of the physical interface that the server
 *   is to listen on. `*` indicates that all interfaces should be listened on.
 *   (This is the same as specifying `::` or `0.0.0.0`.)
 * * `{int} port` -- Port number that the server is to listen on.
 * * `{string} protocol` -- Protocol that the server is to speak. Must be one of
 *   `http`, `http2`, or `https`.
 *
 * **Note:** Exactly one of `server` or `servers` must be present at the top
 * level.
 */
export class ServerManager {
  /** {Map<string, ServerController>} Map from each hostname / wildcard to the
   * {@link ServerController} object that should be used for it. */
  #controllers = new Map();

  /**
   * Adds the config schema for this class to the given validator.
   *
   * @param {Validator} validator The validator to add to.
   */
  static addConfigSchemaTo(validator) {
    // Allows alphanumeric strings that contain dashes, but don't start or end
    // with a dash.
    const serverNamePattern = '^(?!-)[-a-zA-Z0-9]+(?<!-)$';

    const schema = {
      title: 'server-config',
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
              type: 'string'
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
          }
        }
      }
    };

    validator.addSchema(schema, '/ServerManager');
  }

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object.
   */
  constructor(config) {
    ServerManager.#validateConfig(config);

    if (config.server) {
      this.#addControllerFor(config.server);
    }

    if (config.servers) {
      for (const server of config.servers) {
        this.#addControllerFor(server);
      }
    }
  }

  /**
   * Gets the configuration info for the server with the given name.
   *
   * @param {string} name Server name to look for.
   * @returns {object} The associated information.
   */
  findConfig(name) {
    const controller = this.#findController(name);

    if (!controller) {
      throw new Error(`No such server: ${name}`);
    }

    return controller.configObject;
  }

  /**
   * Constructs a {@link ServerController} based on the given information, and
   * adds a mapping to {@link #controllers} so it can be found.
   *
   * @param {object} serverItem Single server item from a configuration object.
   */
  #addControllerFor(serverItem) {
    const controller = new ServerController(serverItem);
    const name = controller.name;

    console.log(`Binding server ${name}.`);

    if (this.#controllers.has(name)) {
      throw new Error(`Duplicate server name: ${name}`);
    }

    this.#controllers.set(name, controller);
  }

  /**
   * Finds the {@link ServerController} for a given server name.
   *
   * @param {string} name Server name to look for.
   * @returns {ServerController|null} The associated information, or `null` if
   *   nothing suitable is found.
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

    const result = v.validate(config, { $ref: '/ServerManager' });
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
 * "Controller" for a single server.
 */
class ServerController {
  /** {string} Server name. */
  #name;

  /** {string} Interface address. */
  #interface;

  /** {int} Port number. */
  #port;

  /** {string} Protocol. */
  #protocol;

  /**
   * Constructs an insance.
   *
   * @param {object} serverConfig Server information configuration item.
   */
  constructor(serverConfig) {
    this.#name      = serverConfig.name;
    this.#interface = serverConfig.interface;
    this.#port      = serverConfig.port;
    this.#protocol  = serverConfig.protocol;
  }

  /** {object} Plain object which recapitulates the original configuration. */
  get configObject() {
    return {
      name:      this.#name,
      interface: this.#interface,
      port:      this.#port,
      protocol:  this.#protocol
    }
  }

  /** {string} Server name. */
  get name() {
    return this.#name;
  }

  /** {string} Interface address. */
  get interface() {
    return this.#interface;
  }

  /** {int} Port number. */
  get port() {
    return this.#port;
  }

  /** {string} Protocol. */
  get protocol() {
    return this.#protocol;
  }
}
