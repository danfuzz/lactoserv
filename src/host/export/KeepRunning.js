// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Threadlet } from '@this/async';
import { WallClock } from '@this/clocky';
import { BaseThreadComponent } from '@this/compy';

import { ProcessInfo } from '#x/ProcessInfo';


/**
 * Utility to guarantee that this process doesn't stop running. By default, Node
 * proactively exits when the event loop quiesces and there do not seem to be
 * any pending actions. However, some systems still want to be able to keep the
 * process up, for some reason or other.
 */
export class KeepRunning extends BaseThreadComponent {
  // @defaultConstructor

  /**
   * Remains running and mostly waiting for a recurring timeout, until asked to
   * stop.
   *
   * @param {Threadlet.RunnerAccess} runnerAccess Thread runner access object.
   */
  async _impl_threadRun(runnerAccess) {
    this.logger?.running();

    // This is a standard-ish trick to keep a Node process alive: Repeatedly set
    // a timeout (or, alternatively, set a recurring timeout), and cancel it
    // (one way or another) when it's okay for the process to exit.
    while (!runnerAccess.shouldStop()) {
      await runnerAccess.raceWhenStopRequested([
        WallClock.waitForMsec(KeepRunning.#MSEC_PER_DAY)
      ]);

      this.logger?.uptime(ProcessInfo.uptime);
    }

    this.logger?.stopped();
  }


  //
  // Static members
  //

  /**
   * The number of milliseconds in a day.
   *
   * @type {number}
   */
  static #MSEC_PER_DAY = 1000 * 60 * 60 * 24;
}
