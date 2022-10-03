// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Condition } from '#x/Condition';

import { MustBe } from '@this/typey';

/**
 * Thread-like thing. This class implements the useful pattern of having an
 * externally-controllable asynchronously-run function.
 *
 * Because of the cooperative-multitasking nature of Node / JavaScript, the
 * function is responsible for proactively figuring out when to stop. It can do
 * this by using the methods {@link #shouldStop} and {@link #whenStopRequested}
 * on the instance of this class that it is called with.
 */
export class Threadoid {
  /** @type {?function(Threadoid): *} Start function to run, if any */
  #startFunction;

  /** @type {function(Threadoid): *} Main function to run. */
  #mainFunction;

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
   * @type {Condition} Has the instance started? This becomes `true` when the
   * instance is running and after the start function has returned from being
   * called.
   */
  #startedCondition = new Condition();


  /**
   * Constructs an instance. It is initally _not_ running.
   *
   * The constructor accepts either one or two thread functions to run, more
   * specifically either just a "main function" or a "start function" followed
   * by a "main function." The thread is considered "started" once it is doing
   * any asynchronous work and after the start function (if specified) has
   * returned. The two-function form is meant to support the common pattern of
   * wanting to do some set of startup actions before a thread is considered
   * running in (some sort of) steady state.
   *
   * The thread functions are always called fully asynchronously (that is, never
   * synchronously during instance construction). And, when called, the
   * functions are passed as an argument the instance of this class that is
   * calling them.
   *
   * @param {function(Threadoid): *} function1 First function to call (start
   *   function or main function).
   * @param {?function(Threadoid): *} [mainFunction = null] Main function, or
   *   `null` if `function1` is actually the main function (and there is no
   *   start function).
   */
  constructor(function1, mainFunction = null) {
    MustBe.callableFunction(function1);

    if (mainFunction) {
      MustBe.callableFunction(mainFunction);
      this.#startFunction = this.#wrapFunction(function1);
      this.#mainFunction  = this.#wrapFunction(mainFunction);
    } else {
      this.#startFunction = null;
      this.#mainFunction  = this.#wrapFunction(function1);
    }
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
   * Has this instance successfully started? This is `true` when the instance
   * has started doing asynchronous running _and_ either it has no start
   * function _or_ the start function has returned without throwing.
   *
   * @returns {boolean} The answer.
   */
  isStarted() {
    return this.#startedCondition.value === true;
  }

  /**
   * Starts this instance running, if it isn't already.  All processing in the
   * thread happens asynchronously with respect to the caller of this method.
   * The async-return value or exception thrown from this method is (in order):
   *
   * * The exception thrown by the start function, if this instance has a start
   *   function which threw.
   * * The exception thrown by the main function, if it threw.
   * * The return value from the main function.
   *
   * **Note:** To be clear, if the instance was already running when this method
   * was called, the return value from this method will be the same value as
   * returned (or the same exception thrown) from the call which actually
   * started the instance running.
   *
   * @returns {*} Whatever is returned by the main function.
   * @throws {Error} Whatever was thrown by either the start function or the
   *   main function.
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
   * the main function, so it can behave cooperatively.
   *
   * @returns {boolean} `true` iff this instance has been asked to stop.
   */
  shouldStop() {
    return this.#runCondition.value === false;
  }

  /**
   * Requests that this instance stop running as soon as possible. This method
   * async-returns the same return value as the call to {@link #run} which
   * started instance. If the instance isn't running when this method is called,
   * it promptly returns `null` (and _not_, e.g., the result of an earlier run).
   *
   * @returns {*} Whatever is returned by the main function.
   * @throws {Error} Whatever was thrown by either the start function or the
   *   main function.
   */
  async stop() {
    if (!this.#runResult) {
      return null;
    }

    this.#runCondition.value = false;
    return this.#runResult;
  }

  /**
   * Gets a promise that becomes fulfilled when this instance is running and
   * after its start function has completed.
   *
   * @returns {Promise} A promise as described.
   */
  whenStarted() {
    return this.#startedCondition.whenTrue();
  }

  /**
   * Gets a promise that becomes fulfilled when this instance has been asked to
   * stop (or when it is already stopped). This method is primarily intended for
   * use by the main function, so it can behave cooperatively.
   *
   * @returns {Promise} A promise as described.
   */
  whenStopRequested() {
    return this.#runCondition.whenFalse();
  }

  /**
   * Properly wraps a function so it can be called with no arguments in
   * {@link #run}.
   *
   * @param {function(*)} func Function to wrap.
   * @returns {function(*)} Wrapped version.
   */
  #wrapFunction(func) {
    return () => func(this);
  }

  /**
   * Runs the thread.
   */
  async #run() {
    // This `await` guarantees that no thread processing happens synchronously
    // with respect to the client (which called `run()`).
    await null;

    try {
      if (this.#startFunction) {
        await this.#startFunction();
      }

      this.#startedCondition.value = true;

      return await this.#mainFunction();
    } finally {
      // Slightly tricky: At this moment, `#runResult` is the return promise
      // from this very method, but it's correct to `null` it out now, because
      // as of the end of this method (which will be happening synchronously),
      // running will have stopped.
      this.#runResult              = null;
      this.#startedCondition.value = false;
      this.#runCondition.value     = false;
    }
  }
}
