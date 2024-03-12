// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { WallClock } from '@this/clocks';
import { IntfLogger } from '@this/loggy-intf';
import { IntfRequestLogger } from '@this/net-protocol';
import { FileServiceConfig } from '@this/sys-config';
import { BaseFileService, Rotator } from '@this/sys-util';


/**
 * Service which writes the access log to the filesystem.
 *
 * See `doc/configuration.md` for configuration object details.
 *
 * @implements {IntfRequestLogger}
 */
export class RequestLogger extends BaseFileService {
  /** @type {?Rotator} File rotator to use, if any. */
  #rotator;

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration for this service.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#rotator = config.rotate ? new Rotator(config, this.logger) : null;
  }

  /** @override */
  async logCompletedRequest(line) {
    await fs.appendFile(this.config.path, `${line}\n`);
  }

  /** @override */
  now() {
    return WallClock.now();
  }

  /** @override */
  async _impl_start(isReload) {
    await this._prot_createDirectoryIfNecessary();
    await this._prot_touchPath();
    await this.#rotator?.start(isReload);
  }

  /** @override */
  async _impl_stop(willReload) {
    await this.#rotator?.stop(willReload);
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return FileServiceConfig;
  }
}
