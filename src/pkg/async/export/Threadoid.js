// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Condition } from '#x/Condition';

import { MustBe } from '@this/typey';

/**
 * Thread-like thing. This class implements the useful pattern of having an
 * externally-controllable asynchronously-run function.
 *
 * Because of the cooperative-multitasking nature of the system, the function is
 * responsible for proactively figuring out when to stop. It can do this by
 * using the methods {@link #shouldStop} and {@link #whenStopRequested} on the
 * instance of this class that it is called with.
 */
export class Threadoid {
  /**
   * @type {function(Promise): *} Function which is to be called asynchronously.
   */
  #threadFunction;

  /**
   * @type {Condition} Intended current state of whether or not this instance is
   * running.
   */
  #runCondition = new Condition();

  /**
   * @type {?Promise<null>} Result of the currently-executing {@link #run}, if
   * currently running.
   */
  #runResult = null;


  /**
   * Constructs an instance. It is initally _not_ running.
   *
   * The constructor accepts either one or two thread functions to run. If
   * passed just one, the thread is considered "started" the moment the function
   * is called. If passed two functions, the thread is considered started only
   * after the first function returns. The two-function form is meant to support
   * the common pattern of wanting to do some set of startup actions before a
   * thread is considered running in (some sort of) steady state.
   *
   * @param {function(Threadoid): *} threadFunction Function to call once
   *   running. The function is always called asynchronously, and it is passed
   *   the instance of this class which it was called from.
   */
  constructor(threadFunction) {
    this.#threadFunction = MustBe.callableFunction(threadFunction).bind(null);
  }

  /**
   * Is this instance currently running?
   *
   * @returns {boolean} The answer.
   */
  isRunning() {
    return this.#runResult !== null;
  }

  /**
   * Starts this instance running, if it isn't already. The return value or
   * exception thrown from this instance's `threadFunction` (constructor
   * argument) is in turn async-returned from this instance. All processing in
   * the thread happens asynchronously with respect to the caller of this
   * method.
   *
   * **Note:** To be clear, if the instance was already running when this method
   * was called, the return value from this method will be the same value as
   * returned (or the same exception thrown) from the call which actually
   * started the instance running.
   *
   * @returns {*} Whatever is returned by the `threadFunction`.
   * @throws {Error} Whatever was thrown by the `threadFunction`.
   */
  async run() {
    if (!this.#runResult) {
      this.#runCondition.value = true;
      this.#runResult = this.#run();
    }

    return this.#runResult;
  }

  /**
   * Should the current run stop? This method is primarily intended for use by
   * the thread function, so it can behave cooperatively.
   *
   * @returns {boolean} `true` iff this instance has been asked to stop.
   */
  shouldStop() {
    return this.#runCondition.value === false;
  }

  /**
   * Requests that this instance stop running as soon as possible.
   */
  stop() {
    this.#runCondition.value = false;
  }

  /**
   * Gets a promise that becomes fulfilled when this instance has been asked to
   * stop (or when it is already stopped). This method is primarily intended for
   * use by the thread function, so it can behave cooperatively.
   *
   * @returns {Promise} A promise as described.
   */
  whenStopRequested() {
    return this.#runCondition.whenFalse();
  }

  /**
   * Runs the thread function.
   */
  async #run() {
    // This `await` guarantees that no event processing happens synchronously
    // with respect to the client (which called `run()`).
    await null;

    try {
      return await this.#threadFunction(this);
    } finally {
      // Slightly tricky: At this moment, `#runResult` is the return promise
      // from this very method, but it's correct to `null` it out now, because
      // as of the end of this method (which will be happening synchronously),
      // running will have stopped.
      this.#runResult = null;
      this.#runCondition.value = false;
    }
  }
}
