// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs/promises';
import * as Path from 'node:path';

import { FileServiceConfig } from '@this/app-config';
import { BaseService, ServiceController } from '@this/app-framework';
import { IntfRequestLogger } from '@this/network-protocol';


/**
 * Service which writes the access log to the filesystem. Configuration object
 * details:
 *
 * Configuration object details:
 *
 * * Bindings as defined by the superclass configuration, {@link
 *   FileServiceConfig}.
 *
 * @implements {IntfRequestLogger}
 */
export class RequestLoggerService extends BaseService {
  /** @type {string} Full path to the log file. */
  #logFilePath;

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration for this service.
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    this.#logFilePath = config.resolvePath();
  }

  /** @override */
  async logCompletedRequest(line) {
    await fs.appendFile(this.#logFilePath, `${line}\n`);
  }

  /** @override */
  async start() {
    const dirPath = Path.resolve(this.#logFilePath, '..');

    // Create the log directory if it doesn't already exist.
    try {
      await fs.stat(dirPath);
    } catch (e) {
      if (e.code === 'ENOENT') {
        await fs.mkdir(dirPath, { recursive: true });
      } else {
        throw e;
      }
    }
  }

  /** @override */
  async stop() {
    // Nothing to do here.
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return FileServiceConfig;
  }

  /** @override */
  static get TYPE() {
    return 'request-logger';
  }
}
