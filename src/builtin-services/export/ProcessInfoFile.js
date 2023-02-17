// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';
import * as timers from 'node:timers/promises';

import { FileServiceConfig } from '@this/app-config';
import { BaseService } from '@this/app-framework';
import { Threadlet } from '@this/async';
import { Converter, ConverterConfig, Duration, Moment } from '@this/data-values';
import { Host, ProcessInfo, ProductInfo } from '@this/host';
import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';


/**
 * Service which writes process info files to the filesystem. Configuration
 * object details:
 *
 * Configuration object details:
 *
 * * Bindings as defined by the superclass configuration, {@link
 *   FileServiceConfig}.
 * * `{?number} updateSecs` -- How often to update the file, in seconds, or
 *   `null` to not perform updates. Defaults to `null`.
 *
 * **Note:** See {@link #ProcessInfoFile} for a service which writes more
 * complete information about the system.
 */
export class ProcessInfoFile extends BaseService {
  /**
   * @type {?number} How often to update the info file, in seconds, or `null` to
   * not perform updates.
   */
  #updateSecs;

  /** @type {string} The path to the info file. */
  #filePath;

  /** @type {?object} Current info file contents, if known. */
  #contents = null;

  /** @type {Converter} Data converter to use for encoding the file. */
  #dataConverter = new Converter(ConverterConfig.makeLoggingInstance());

  /** @type {Threadlet} Threadlet which runs this service. */
  #runner = new Threadlet(() => this.#start(), () => this.#run());

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration for this service.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    const { updateSecs } = config;
    this.#updateSecs = (updateSecs === null)
      ? null
      : MustBe.number(updateSecs, { finite: true, minInclusive: 1 });

    this.#filePath   = config.resolvePath(`-${process.pid}`);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    await this.#runner.start();
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    await this.#runner.stop();
  }

  /**
   * Makes the initial value for {@link #contents}.
   *
   * @returns {object} The contents.
   */
  async #makeContents() {
    const contents = {
      product: ProductInfo.allInfo,
      ...ProcessInfo.allInfo
    };

    const fileContents = await this.#readFile();

    if (fileContents) {
      if (fileContents.earlierRuns) {
        const earlier = fileContents.earlierRuns;
        delete fileContents.earlierRuns;
        earlier.push(fileContents);
        contents.earlierRuns = earlier;
      } else {
        contents.earlierRuns = [fileContents];
      }

      // Given that the file already exists, this is a restart, and so the
      // `startedAt` from `ProcessInfo` (which will appear in the earliest of
      // the `earlierRuns`) is kinda moot. Instead, substitute the current time,
      // that is, the _restart_ time.
      contents.startedAt = new Moment(Date.now() / 1000).toPlainObject();
    }

    return contents;
  }

  /**
   * Reads the info file, if it exists. If it exists but can't be read and
   * parsed, the problem is reported via the returned contents (stringified
   * exception).
   *
   * @returns {?object} Parsed info file if it exists, or `null` if the file
   *   does not exist.
   */
  async #readFile() {
    const filePath = this.#filePath;

    try {
      await fs.stat(filePath);
      const text   = await fs.readFile(filePath);
      const parsed = JSON.parse(text);

      this.logger.readFile();
      return parsed;
    } catch (e) {
      if (e.code === 'ENOENT') {
        return null;
      } else {
        this.logger.errorReadingFile(e);
        return { error: e.stack };
      }
    }
  }

  /**
   * Runs the service thread.
   */
  async #run() {
    while (!this.#runner.shouldStop()) {
      this.#updateDisposition();
      await this.#writeFile();

      const updateTimeout = this.#updateSecs
        ? [timers.setTimeout(this.#updateSecs * 1000)]
        : [];

      await Promise.race([
        ...updateTimeout,
        this.#runner.whenStopRequested()
      ]);
    }

    await this.#stop();
  }

  /**
   * Starts the service thread.
   */
  async #start() {
    this.#contents = await this.#makeContents();
  }

  /**
   * Stops the service thread.
   */
  async #stop() {
    const contents      = this.#contents;
    const stoppedAtSecs = Date.now() / 1000;
    const uptimeSecs    = stoppedAtSecs - contents.startedAt.atSecs;

    contents.stoppedAt = new Moment(stoppedAtSecs).toPlainObject();
    contents.uptime    = new Duration(uptimeSecs).toPlainObject();

    if (Host.isShuttingDown()) {
      contents.disposition = Host.shutdownDisposition();
    } else {
      contents.disposition = { restarting: true };
    }

    // Try to get `earlierRuns` to be a the end of the object when it gets
    // encoded to JSON, for easier (human) reading.
    if (contents.earlierRuns) {
      const earlierRuns = contents.earlierRuns;
      delete contents.earlierRuns;
      contents.earlierRuns = earlierRuns;
    }

    await this.#writeFile();
  }

  /**
   * Updates {@link #disposition} to reflect a run still in progress.
   */
  #updateDisposition() {
    const updatedAtSecs = Date.now() / 1000;

    this.#contents.disposition = {
      running:   true,
      updatedAt: new Moment(updatedAtSecs).toPlainObject(),
      uptime:    new Duration(updatedAtSecs - this.#contents.startedAt.atSecs).toPlainObject()
    };
  }

  /**
   * Writes the info file.
   */
  async #writeFile() {
    const encoded = this.#dataConverter.encode(this.#contents);
    const text = `${JSON.stringify(encoded, null, 2)}\n`;

    await this.config.createDirectoryIfNecessary();
    await fs.writeFile(this.#filePath, text);

    this.logger.wroteFile();
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends FileServiceConfig {
    /**
     * @type {?number} How often to update the info file, in seconds, or `null`
     * to not perform updates.
     */
    #updateSecs;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      this.#updateSecs = config.updateSecs
        ? MustBe.number(config.updateSecs, { finite: true, minInclusive: 1 })
        : MustBe.null(config.updateSecs ?? null);
    }

    /**
     * @returns {?number} How often to update the info file, in seconds, or
     * `null` to not perform updates.
     */
    get updateSecs() {
      return this.#updateSecs;
    }
  };
}
