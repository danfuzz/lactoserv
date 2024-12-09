// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventTracker, LinkedEvent } from '@this/async';
import { WallClock } from '@this/clocky';
import { Loggy, TextFileSink } from '@this/loggy';
import { Duration } from '@this/quant';
import { MustBe } from '@this/typey';
import { BaseFileService, Rotator } from '@this/webapp-util';


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
  async _impl_init() {
    const { config } = this;
    this.#rotator = config.rotate ? new Rotator(config, this.logger) : null;

    await super._impl_init();
  }

  /** @override */
  async _impl_start() {
    await this._prot_createDirectoryIfNecessary();
    await this._prot_touchPath();
    await this.#rotator?.start();

    const { bufferPeriod, format, name, path } = this.config;
    const earliestEvent = this.#findEarliestEventToLog(name);
    this.#sink = new TextFileSink(format, path, earliestEvent, bufferPeriod);

    await this.#sink.start();

    await super._impl_start();
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
    this.logger?.[SyslogToFile.#END_EVENT_TYPE]();

    await this.#sink.drainAndStop();
    await this.#rotator?.stop(willReload);
    await super._impl_stop(willReload);
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
    const tagToFind     = this.logger?.$meta.tag ?? null;

    if (!tagToFind) {
      // This service doesn't itself have a logger, so there's no previous-last
      // event to look for.
      return earliestEvent;
    }

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
    return class Config extends super.prototype.constructor.configClass {
      // @defaultConstructor

      /**
       * How long to buffer updates for, or `null` to not do any buffering. If
       * passed as a string, it is parsed by {@link Duration#parse}.
       *
       * @param {?string|Duration} value Proposed configuration value. Default
       *   `null`.
       * @returns {?Duration} Accepted configuration value.
       */
      _config_bufferPeriod(value = null) {
        if (value === null) {
          return null;
        }

        const result = Duration.parse(value, { range: { minInclusive: 0 } });

        if (!result) {
          throw new Error(`Could not parse \`bufferPeriod\`: ${value}`);
        }

        return (result === 0) ? null : result;
      }

      /**
       * The output format name. Must be valid per
       * {@link TextFileSink#isValidFormat}.
       *
       * @param {string} value Proposed configuration value.
       * @returns {string} Accepted configuration value.
       */
      _config_format(value) {
        MustBe.string(value);

        if (!TextFileSink.isValidFormat(value)) {
          throw new Error(`Unknown log format: ${value}`);
        }

        return value;
      }
    };
  }
}
