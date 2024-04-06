// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventTracker, LinkedEvent } from '@this/async';
import { WallClock } from '@this/clocks';
import { Duration } from '@this/data-values';
import { Loggy, TextFileSink } from '@this/loggy';
import { BaseFileService, Rotator } from '@this/sys-util';
import { MustBe } from '@this/typey';


/**
 * Service which writes the main log to the filesystem.
 *
 * See `doc/configuration` for configuration object details.
 */
export class SyslogToFile extends BaseFileService {
  /**
   * File rotator to use, if any.
   *
   * @type {?Rotator}
   */
  #rotator = null;

  /**
   * Event sink which does the actual writing, or `null` if not yet set up.
   *
   * @type {?TextFileSink}
   */
  #sink = null;

  // @defaultConstructor

  /** @override */
  async _impl_init(isReload_unused) {
    // Having a logger available is optional for most classes, but for this one
    // it is essential!
    if (!this.logger) {
      throw new Error('Cannot use this class without a logger.');
    };

    const { config } = this;
    this.#rotator = config.rotate ? new Rotator(config, this.logger) : null;
  }

  /** @override */
  async _impl_start(isReload) {
    await this._prot_createDirectoryIfNecessary();
    await this._prot_touchPath();
    await this.#rotator?.start(isReload);

    const { bufferPeriod, format, name, path } = this.config;
    const earliestEvent = this.#findEarliestEventToLog(name);
    this.#sink = new TextFileSink(format, path, earliestEvent, bufferPeriod);

    await this.#sink.start();
    this.logger.running();
  }

  /** @override */
  async _impl_stop(willReload) {
    // Wait briefly, so that there's a decent chance that this instance catches
    // most or all of the other stop-time messages before doing its own final
    // message.
    await WallClock.waitForMsec(100); // 100msec

    // Note: Upon construction, instances of this class look for an event of the
    // form being logged here, and will start just past it if found. This is to
    // reasonably-gracefully handle the case of a successor instance to this one
    // during a same-process system restart (e.g. in response to a restart
    // signal). In particular, this is an attempt to minimize double-logging
    // events.
    this.logger[SyslogToFile.#END_EVENT_TYPE]();

    await this.#sink.drainAndStop();
    await this.#rotator?.stop(willReload);
  }

  /**
   * Figures out which event to actually write out first. When a system is first
   * starting up, this will be the actual earliest recored event. However, in
   * the case of a same-process restart, this method attempts to find the event
   * just after the last one expected to have been logged by a predecessor
   * instance.
   *
   * @returns {LinkedEvent|Promise<LinkedEvent>} First event to log.
   */
  #findEarliestEventToLog() {
    const earliestEvent = Loggy.earliestEvent;
    const tracker       = new EventTracker(earliestEvent);
    const tagToFind     = this.logger.$meta.tag;

    const found = tracker.advanceSync((event) => {
      return (event.type === SyslogToFile.#END_EVENT_TYPE)
        && (event.payload.tag.equals(tagToFind));
    });

    return found ? found.nextPromise : earliestEvent;
  }


  //
  // Static members
  //

  /**
   * Event type that marks the end of logging.
   *
   * @type {string}
   */
  static #END_EVENT_TYPE = 'finalLoggedEvent';

  /** @override */
  static _impl_configClass() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseFileService.Config {
    /**
     * How long to buffer updates for, or `null` to not do any buffering.
     *
     * @type {?Duration}
     */
    #bufferPeriod;

    /**
     * The output format name.
     *
     * @type {string}
     */
    #format;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const { bufferPeriod = null, format } = rawConfig;

      if (bufferPeriod) {
        this.#bufferPeriod = Duration.parse(bufferPeriod, { minInclusive: 0 });
        if (!this.#bufferPeriod) {
          throw new Error(`Could not parse \`bufferPeriod\`: ${bufferPeriod}`);
        }
        if (this.#bufferPeriod === 0) {
          this.#bufferPeriod = null;
        }
      } else {
        this.#bufferPeriod = MustBe.null(bufferPeriod);
      }

      this.#format = MustBe.string(format);

      if (!TextFileSink.isValidFormat(format)) {
        throw new Error(`Unknown log format: ${format}`);
      }
    }

    /**
     * @returns {?Duration} How long to buffer updates for, or `null` to not do
     * any buffering.
     */
    get bufferPeriod() {
      return this.#bufferPeriod;
    }

    /** @returns {string} The output format name. */
    get format() {
      return this.#format;
    }
  };
}
