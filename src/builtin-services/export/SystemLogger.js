// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as timers from 'node:timers/promises';

import { EventTracker, LinkedEvent } from '@this/async';
import { IntfLogger, Loggy, TextFileSink } from '@this/loggy';
import { FileServiceConfig } from '@this/sys-config';
import { BaseFileService, Rotator } from '@this/sys-util';
import { MustBe } from '@this/typey';


/**
 * Service which writes the main log to the filesystem.
 *
 * Configuration object details:
 *
 * * Bindings as defined by the superclass configuration, {@link
 *   FileServiceConfig}. Supports `rotate`.
 * * `{string} format` -- The format to write. Must be one of the formats
 *   defined by {@link TextFileSink} (`json` or `human` as of this writing, but
 *   subject to change).
 */
export class SystemLogger extends BaseFileService {
  /** @type {?Rotator} File rotator to use, if any. */
  #rotator;

  /**
   * @type {?TextFileSink} Event sink which does the actual writing, or `null`
   * if not yet set up.
   */
  #sink = null;

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
  async _impl_start(isReload) {
    await this.config.createDirectoryIfNecessary();
    await this.config.touchPath();
    await this.#rotator?.start(isReload);

    const { format, name, path } = this.config;
    const earliestEvent = this.#findEarliestEventToLog(name);
    this.#sink = new TextFileSink(format, path, earliestEvent);

    await this.#sink.start();
    this.logger.running();
  }

  /** @override */
  async _impl_stop(willReload) {
    // Wait briefly, so that there's a decent chance that this instance catches
    // most or all of the other stop-time messages before doing its own final
    // message.
    await timers.setTimeout(100); // 100msec

    // Note: Upon construction, instances of this class look for an event of the
    // form being logged here, and will start just past it if found. This is to
    // reasonably-gracefully handle the case of a successor instance to this one
    // during a same-process system restart (e.g. in response to a restart
    // signal). In particular, this is an attempt to minimize double-logging
    // events.
    this.logger[SystemLogger.#END_EVENT_TYPE]();

    await this.#sink.drainAndStop();
    await this.#rotator?.stop(willReload);
  }

  /**
   * Figures out which event to actually write out first. When a system is
   * first starting up, this will be the actual earliest recored event. However,
   * in the case of a same-process restart, this method attempts to find the
   * event just after the last one expected to have been logged by a predecessor
   * instance.
   *
   * @returns {LinkedEvent|Promise<LinkedEvent>} First event to log.
   */
  #findEarliestEventToLog() {
    const earliestEvent = Loggy.earliestEvent;
    const tracker       = new EventTracker(earliestEvent);
    const tagToFind     = this.logger.$meta.tag;

    const found = tracker.advanceSync((event) => {
      return (event.type === SystemLogger.#END_EVENT_TYPE)
        && (event.payload.tag.equals(tagToFind));
    });

    return found ? found.nextPromise : earliestEvent;
  }


  //
  // Static members
  //

  /** @type {string} Event type that marks the end of logging. */
  static #END_EVENT_TYPE = 'finalLoggedEvent';

  /** @override */
  static get CONFIG_CLASS() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends FileServiceConfig {
    /** @type {string} The output format name. */
    #format;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      this.#format = MustBe.string(config.format);

      if (!TextFileSink.isValidFormat(this.#format)) {
        throw new Error(`Unknown log format: ${this.#format}`);
      }
    }

    /** @returns {string} The output format name. */
    get format() {
      return this.#format;
    }
  };
}
