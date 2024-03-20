// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { Threadlet } from '@this/async';
import { WallClock } from '@this/clocks';
import { Duration } from '@this/data-values';
import { Statter } from '@this/fs-util';
import { Host, ProcessInfo, ProcessUtil, ProductInfo }
  from '@this/host';
import { FileServiceConfig } from '@this/sys-config';
import { BaseFileService, Saver } from '@this/sys-util';
import { MustBe } from '@this/typey';


/**
 * Service which writes process info files to the filesystem.
 *
 * See `doc/configuration.md` for configuration object details.
 *
 * **Note:** See {@link #ProcessIdFile} for a service which writes minimal
 * information about active processes.
 */
export class ProcessInfoFile extends BaseFileService {
  /** @type {?object} Current info file contents, if known. */
  #contents = null;

  /** @type {?Saver} File saver (preserver) to use, if any. */
  #saver = null;

  /** @type {Threadlet} Threadlet which runs this service. */
  #runner = new Threadlet(() => this.#start(), () => this.#run());

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration for this service.
   */
  constructor(config) {
    super(config);
  }

  /** @override */
  async _impl_init(isReload_unused) {
    const { config } = this;
    this.#saver = config.save ? new Saver(config, this.logger) : null;
  }

  /** @override */
  async _impl_start(isReload) {
    if (this.#saver) {
      if (!isReload) {
        await this.#fixOldFileIfNecessary();
      }

      // Give the saver a chance to take action _before_ we start our runner
      // (which will quickly overwrite a pre-existing info file at the
      // un-infixed path).
      await this.#saver.start(isReload);
    }

    if (isReload) {
      // This only matters if configured with `save: { onReload: true }`, in
      // which case this gets included in the new file as a way of indicating
      // continuity.
      this.#contents = {
        earlierRuns: [{
          disposition: 'inOtherInfoFiles'
        }]
      };
    }

    await this.#runner.start();
  }

  /** @override */
  async _impl_stop(willReload) {
    await this.#runner.stop();
    await this.#stop(willReload);

    if (this.#saver) {
      // Note: We stopped our runner before telling the saver, so that the final
      // file write could get renamed by the saver (if that's how it was
      // configured).
      this.#saver.stop(willReload);
    }
  }

  /**
   * "Fixes" a pre-existing file, if it turns out to represent a process which
   * got shut down abruptly (without indicating a "shutdown" disposition).
   */
  async #fixOldFileIfNecessary() {
    const contents = await this.#readFile();

    if (!(contents?.disposition && contents?.pid)) {
      // Indicative of the file not existing or there being trouble reading and
      // parsing the file. So, don't bother with the rest.
      return;
    }

    if (contents.disposition.running
        && !ProcessUtil.processExists(contents.pid)) {
      // The contents say that the process in question is running, but it
      // verifiably is not. So, update and rewrite.
      delete contents.disposition.running;
      contents.disposition = {
        abruptlyStopped: true, // So it is first when serialized.
        ...contents.disposition
      };
      this.logger?.fixedOldFile();
      await this.#writeFile(contents);
    }
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

    delete contents.uptime; // Ends up in `disposition`.

    const fileContents = await this.#readFile();

    if (fileContents?.pid === contents.pid) {
      // The file existed and corresponds to this process. So, incorporate its
      // info into our own contents.
      if (fileContents.earlierRuns) {
        const earlier = fileContents.earlierRuns;
        delete fileContents.earlierRuns;
        earlier.push(fileContents);
        contents.earlierRuns = earlier;
      } else {
        contents.earlierRuns = [fileContents];
      }
    } else if (this.#contents?.earlierRuns) {
      // **Note:** `this.#contents` is only possibly non-empty if this instance
      // was configured with `save: { onReload: true }`.
      contents.earlierRuns = this.#contents.earlierRuns;
    }

    if (contents.earlierRuns) {
      // Given that we're here, this is a reload, and so the `startedAt` from
      // `ProcessInfo` (which will appear in the earliest of the `earlierRuns`)
      // is kinda moot. Instead, substitute the current time, that is, the
      // _reload_ time.
      contents.startedAt = WallClock.now().toPlainObject();
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
    const filePath = this.config.path;

    try {
      if (!await Statter.fileExists(filePath)) {
        return null;
      }

      const text   = await fs.readFile(filePath, { encoding: 'utf-8' });
      const parsed = JSON.parse(text);

      this.logger?.readFile();
      return parsed;
    } catch (e) {
      this.logger?.errorReadingFile(e);
      return { error: e.stack };
    }
  }

  /**
   * Runs the service thread.
   */
  async #run() {
    const updateMsec = this.config.updatePeriod?.msec ?? null;

    while (!this.#runner.shouldStop()) {
      this.#updateContents();
      await this.#writeFile();

      if (updateMsec) {
        const timeout = WallClock.waitForMsec(updateMsec);
        await this.#runner.raceWhenStopRequested([timeout]);
      } else {
        await this.#runner.whenStopRequested();
      }
    }
  }

  /**
   * Starts the service thread.
   */
  async #start() {
    this.#contents = await this.#makeContents();
  }

  /**
   * Stops the service thread.
   *
   * @param {boolean} willReload Is the system going to be reloaded in-process?
   */
  async #stop(willReload) {
    const contents  = this.#contents;
    const stoppedAt = WallClock.now();
    const uptimeSec = stoppedAt.atSec - contents.startedAt.atSec;

    if (willReload) {
      contents.disposition = { reloading: true };
    } else {
      // The part after the `??` shouldn't happen.
      contents.disposition = Host.shutdownDisposition()
        ?? {
          reloading:         true,
          shutdownRequested: true
        };
    }

    contents.disposition.stoppedAt = stoppedAt.toPlainObject();
    contents.disposition.uptime    = Duration.plainObjectFromSec(uptimeSec);

    // Try to get `earlierRuns` to be at the end of the object when it gets
    // encoded to JSON, for easier (human) reading.
    if (contents.earlierRuns) {
      const earlierRuns = contents.earlierRuns;
      delete contents.earlierRuns;
      contents.earlierRuns = earlierRuns;
    }

    await this.#writeFile();
  }

  /**
   * Updates {@link #contents} to reflect the latest conditions.
   */
  #updateContents() {
    this.#contents.disposition = {
      running:   true,
      updatedAt: WallClock.now().toPlainObject(),
      uptime:    ProcessInfo.uptime.toPlainObject()
    };

    const ephemera = ProcessInfo.ephemeralInfo;
    delete ephemera.uptime; // Redundant with what we put into `disposition`.

    Object.assign(this.#contents, ephemera);
  }

  /**
   * Writes the info file.
   *
   * @param {?object} [contents] Contents to write instead of {@link
   * #contents}, or `null` to write from the private property.
   */
  async #writeFile(contents = null) {
    const obj  = contents ?? this.#contents;
    const text = `${JSON.stringify(obj, null, 2)}\n`;

    await this._prot_createDirectoryIfNecessary();
    await fs.writeFile(this.config.path, text);

    this.logger?.wroteFile();
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
     * @type {?Duration} How often to update the info file, or `null` to not
     * perform updates.
     */
    #updatePeriod;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const { updatePeriod = null } = config;

      if (updatePeriod) {
        this.#updatePeriod = Duration.parse(updatePeriod, { minInclusive: 1 });
        if (!this.#updatePeriod) {
          throw new Error(`Could not parse \`updatePeriod\`: ${updatePeriod}`);
        }
      } else {
        this.#updatePeriod = MustBe.null(updatePeriod);
      }
    }

    /**
     * @returns {?Duration} How often to update the info file, or `null` to not
     * perform updates.
     */
    get updatePeriod() {
      return this.#updatePeriod;
    }
  };
}
