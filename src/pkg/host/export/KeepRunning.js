// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as timers from 'node:timers/promises';

import { Threadlet } from '@this/async';
import { FormatUtils } from '@this/loggy';

import { ProcessInfo } from '#x/ProcessInfo';
import { ThisModule } from '#p/ThisModule';


/** @type {function(...*)} Logger for this class. */
const logger = ThisModule.logger.keepRunning;

/**
 * Utility to guarantee that this process doesn't stop running. By default,
 * Node proactively exits when the event loop quiesces and there do not seem
 * to be any pending actions. However, some systems still want to be able to
 * keep the process up, for whatever reason.
 */
export class KeepRunning {
  /** @type {Threadlet} Thread that runs {@link #keepRunning}. */
  #thread;

  /**
   * Constructs an instance.
   */
  constructor() {
    this.#thread = new Threadlet(() => this.#keepRunning());
  }

  /**
   * Initiates the actions required to keep the system running.
   */
  run() {
    if (this.#thread.isRunning()) {
      logger.run('ignored');
      return;
    }

    logger.run();
    this.#thread.run();
  }

  /**
   * No longer keep the system running.
   */
  stop() {
    if (!this.#thread.isRunning()) {
      logger.stop('ignored');
      return;
    }

    logger.stop();
    this.#thread.stop();
  }

  /**
   * Remains running and mostly waiting for a recurring timeout, until asked to
   * stop.
   */
  async #keepRunning() {
    const startedAtSecs = ProcessInfo.allInfo.startedAt.atSecs;

    logger.running();

    // This is a standard-ish trick to keep a Node process alive: Repeatedly set
    // a timeout (or, alternatively, set a recurring timeout), and cancel it
    // (one way or another) when it's okay for the process to exit.
    while (!this.#thread.shouldStop()) {
      await Promise.race([
        timers.setTimeout(KeepRunning.#MSEC_PER_DAY),
        this.#thread.whenStopRequested()
      ]);

      const uptimeSecs = (Date.now() / 1000) - startedAtSecs;
      logger.uptime(FormatUtils.compoundDurationFromSecs(uptimeSecs));
    }

    logger.stopped();
  }


  //
  // Static members
  //

  /** @type {number} The number of milliseconds in a day. */
  static #MSEC_PER_DAY = 1000 * 60 * 60 * 24;
}
