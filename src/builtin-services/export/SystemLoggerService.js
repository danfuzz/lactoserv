// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as timers from 'node:timers/promises';

import { FileServiceConfig } from '@this/app-config';
import { BaseService, ServiceController } from '@this/app-framework';
import { Rotator } from '@this/app-util';
import { EventTracker } from '@this/async';
import { LogEvent, Loggy, TextFileSink } from '@this/loggy';
import { MustBe } from '@this/typey';


/**
 * Service which writes the main log to the filesystem.
 *
 * Configuration object details:
 *
 * * Bindings as defined by the superclass configuration, {@link
 *   FileServiceConfig}.
 * * `{string} format` -- The format to write. Must be one of the formats
 *   defined by {@link TextFileSink} (`json` or `human` as of this writing, but
 *   subject to change).
 */
export class SystemLoggerService extends BaseService {
  /** @type {string} Full path to the log file. */
  #logFilePath;

  /** @type {?Rotator} File rotator to use, if any. */
  #rotator;

  /** @type {TextFileSink} Event sink which does the actual writing. */
  #sink;

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration for this service.
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    const { format, name } = config;
    const earliestEvent = this.#findEarliestEventToLog(name);

    this.#logFilePath = config.resolvePath();
    this.#rotator     = config.rotate ? new Rotator(config, this.logger) : null;
    this.#sink        = new TextFileSink(format, this.#logFilePath, earliestEvent);
  }

  /** @override */
  async _impl_start(isReload) {
    await this.config.createDirectoryIfNecessary();
    await this.#rotator?.start(isReload);
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
    this.logger[SystemLoggerService.#END_EVENT_TYPE]();

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
   * @returns {LogEvent|Promise<LogEvent>} First event to log.
   */
  #findEarliestEventToLog() {
    const earliestEvent = Loggy.earliestEvent;
    const tracker       = new EventTracker(earliestEvent);
    const tagToFind     = this.logger.$meta.tag;

    const found = tracker.advanceSync((event) => {
      return (event.type === SystemLoggerService.#END_EVENT_TYPE)
        && (event.tag.equals(tagToFind));
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

  /** @override */
  static get TYPE() {
    return 'system-logger';
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
