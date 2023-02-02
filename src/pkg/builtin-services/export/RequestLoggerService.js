// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs/promises';

import { FileServiceConfig } from '@this/app-config';
import { BaseService, ServiceController } from '@this/app-framework';
import { Rotator } from '@this/app-util';
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

  /** @type {?Rotator} File rotator to use, if any. */
  #rotator;

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration for this service.
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    this.#logFilePath = config.resolvePath();
    this.#rotator     = config.rotate ? new Rotator(config, this.logger) : null;
  }

  /** @override */
  async logCompletedRequest(line) {
    await fs.appendFile(this.#logFilePath, `${line}\n`);
    await this.#rotator?.onWrite();
  }

  /** @override */
  async start(isReload) {
    await this.config.createDirectoryIfNecessary();
    if (isReload) {
      this.#rotator?.onReload();
    } else {
      this.#rotator?.onStart();
    }
  }

  /** @override */
  async stop(willReload) {
    if (!willReload) {
      this.#rotator?.onStop();
    }
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
