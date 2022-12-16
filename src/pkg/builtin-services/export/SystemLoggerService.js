// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs/promises';
import * as Path from 'node:path';
import * as timers from 'node:timers/promises';

import { Files, ServiceConfig } from '@this/app-config';
import { BaseService, ServiceController } from '@this/app-services';
import { EventTracker } from '@this/async';
import { LogEvent, Loggy, TextFileSink } from '@this/loggy';


/**
 * Service which writes the main log to the filesystem. Configuration object
 * details:
 *
 * * `{string} directory` -- Absolute path to the directory to write to.
 * * `{string} baseName` -- Base file name for the log files.
 */
export class SystemLoggerService extends BaseService {
  /** @type {string} Full path to the log file. */
  #logFilePath;

  /** @type {TextFileSink} Event sink which does the actual writing. */
  #sink;

  /** @type {function(*)} Logger for this instance. */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {ServiceController} controller The controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    const { baseName, directory, name } = config;
    const earliestEvent = this.#findEarliestEventToLog(name);

    this.#logFilePath = Path.resolve(directory, `${baseName}.txt`);
    this.#sink        = new TextFileSink(this.#logFilePath, earliestEvent);
    this.#logger      = SystemLoggerService.#classLogger[name];
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

    await this.#sink.start();
    this.#logger.started();
  }

  /** @override */
  async stop() {
    // Note: Upon construction, instances of this class look for an event of the
    // form being logged here, and will start just past it if found. This is to
    // reasonably-gracefully handle the case of a successor instance to this one
    // during a same-process system restart (e.g. in response to a restart
    // signal). In particular, this is an attempt to minimize double-logging
    // events.
    this.#logger.stopped();

    // Wait briefly, so that there's a decent chance that this instance catches
    // most or all of the other stop-time messages.
    await timers.setTimeout(100); // 100msec

    await this.#sink.drainAndStop();
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

    const found = tracker.advanceSync((event) => {
      const tag = event.tag;
      return (tag.main === SystemLoggerService.#LOG_TAG)
        && (tag.context.length === 1)
        && (tag.context[0] === this.name)
        && (event.type === 'stopped');
    });

    return found ? found.nextPromise : earliestEvent;
  }


  //
  // Static members
  //

  /** @type {string} Main log tag for this class. */
  static #LOG_TAG = 'syslog';

  /** @type {function(*)} Logger for this class. */
  static #classLogger = Loggy.loggerFor([this.#LOG_TAG]);

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
  static #Config = class Config extends ServiceConfig {
    /** @type {string} The base file name to use. */
    #baseName;

    /** @type {string} The directory to write to. */
    #directory;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      this.#baseName = Files.checkFileName(config.baseName);
      this.#directory = Files.checkAbsolutePath(config.directory);
    }

    /** @returns {string} The base file name to use. */
    get baseName() {
      return this.#baseName;
    }

    /** @returns {string} The directory to write to. */
    get directory() {
      return this.#directory;
    }
  };
}
