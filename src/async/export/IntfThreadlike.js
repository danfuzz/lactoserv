// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';


/**
 * Interface for thread-like things, which can be started, stopped, queried
 * about state, and are capable of yielding a result from running.
 *
 * @interface
 */
export class IntfThreadlike {
  /**
   * Indicates if this instance is currently running.
   *
   * @returns {boolean} `true` if this instance is currently running, or `false`
   *   if not.
   */
  isRunning() {
    throw Methods.abstract();
  }

  /**
   * Starts this instance running, if it isn't already. This async-returns once
   * the run is complete.
   *
   * **Note:** To be clear, if the instance was already running when this method
   * was called, the return value from this method will be the same value as
   * returned (or the same exception thrown) from the call which actually
   * started the instance running.
   *
   * @returns {*} Whatever result is produced by the instance's action of
   *   running whatever it is that it runs.
   * @throws {Error} Anything thrown while the instance ran or tried to run.
   */
  async run() {
    throw Methods.abstract();
  }

  /**
   * Starts this instance running as with {@link #run}, except that it
   * async-returns once the instance is _started_, as with {@link #whenStarted}.
   *
   * @returns {*} Return value from {@link #whenStarted} (see which).
   * @throws {Error} Error thrown by {@link #whenStarted} (see which).
   */
  async start() {
    throw Methods.abstract();
  }

  /**
   * Requests that this instance stop running as soon as possible. If this
   * instance was started by a call to {@link #run}, then this method
   * async-returns the same return value as what that call returns. If the
   * instance isn't running when this method is called, it promptly returns
   * `null` (and _not_, e.g., the result of an earlier run).
   *
   * @returns {*} Whatever was (or would have been) returned by {@link #run}.
   * @throws {Error} Whatever was (or would have been) thrown by {@link #run}.
   */
  async stop() {
    throw Methods.abstract();
  }

  /**
   * Gets a promise that becomes settled when this instance is running and after
   * any pre-run actions have been completed. It becomes settled (fulfilled or
   * rejected) with the result of the pre-run actions. If `isRunning() ===
   * false` when this method is called, it async-returns `null` promptly.
   *
   * @returns {*} Whatever was returned by the pre-run actions, or `null` if
   *   there were no pre-run actions.
   * @throws {Error} Whatever was thrown by the pre-run actions.
   */
  async whenStarted() {
    throw Methods.abstract();
  }
}
