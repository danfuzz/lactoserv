// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { Condition } from '#x/Condition';
import { IntfThread } from '#x/IntfThread';
import { PromiseUtil } from '#x/PromiseUtil';


/**
 * Thread-like thing. This class implements the useful pattern of having an
 * externally-controllable asynchronously-run function.
 *
 * Because of the cooperative-multitasking nature of Node / JavaScript, the
 * function is responsible for proactively figuring out when to stop. It can do
 * this by using the methods {@link #shouldStop} and {@link #whenStopRequested}
 * on the instance of this class that it is called with.
 *
 * @implements {IntfThread}
 */
export class Threadlet {
  /**
   * Start function to run, if any
   *
   * @type {?function(Threadlet): *}
   */
  #startFunction;

  /**
   * Main function to run.
   *
   * @type {function(Threadlet): *}
   */
  #mainFunction;

  /**
   * Access instance passed to {@link #startFunction} and {@link #mainFunction}.
   *
   * @type {Threadlet.RunnerAccess}
   */
  #runnerAccess;

  /**
   * Intended current state of whether or not this instance is running. That is,
   * it answers the question "Should we be running?" and not "Are we actually
   * running?"
   *
   * @type {Condition}
   */
  #runningCondition = new Condition();

  /**
   * Promised result of the currently-executing {@link #run}, if the instance is
   * currently running.
   *
   * @type {?Promise}
   */
  #runResult = null;

  /**
   * Promised result of calling {@link #start}, if the instance is currently
   * running (at all, not just in the start function). `null` if not running or
   * if the instance doesn't have a start function.
   *
   * @type {?Promise}
   */
  #startResult = null;

  /**
   * Has the current {@link #runResult} been returned "publicly" from this
   * instance? This is used to figure out whether to force a failed run to
   * become an unhandled promise rejection.
   *
   * @type {boolean}
   */
  #runResultExposed = false;


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
   * synchronously during instance construction nor synchronously with respect
   * to a call to {@link #run}). When called, the functions are passed as an
   * argument the instance of this class that is calling them.
   *
   * @param {function(Threadlet.RunnerAccess): *} function1 First function to
   *   call (start function or main function).
   * @param {?function(Threadlet.RunnerAccess): *} [mainFunction] Main function,
   *   or `null` if `function1` is actually the main function (and there is no
   *   start function).
   */
  constructor(function1, mainFunction = null) {
    MustBe.callableFunction(function1);

    if (mainFunction) {
      MustBe.callableFunction(mainFunction);
      this.#startFunction = function1;
      this.#mainFunction  = mainFunction;
    } else {
      this.#startFunction = null;
      this.#mainFunction  = function1;
    }

    this.#runnerAccess = new Threadlet.RunnerAccess(this);
  }

  /** @override */
  isRunning() {
    return this.#runResult !== null;
  }

  /**
   * As a clarification to the interface's contract for this method, the
   * async-return value or exception thrown from this method is (in order):
   *
   * * The exception thrown by the start function, if this instance has a start
   *   function which threw.
   * * The exception thrown by the main function, if it threw.
   * * The return value from the main function.
   *
   * @override
   */
  async run() {
    return this.#run(true);
  }

  /** @override */
  async start() {
    // Squelch any error from `run()`, because otherwise it will turn into an
    // impossible-to-actually-handle promise rejection. It's up to clients to
    // use some other method to detect an exception, e.g. by calling `stop()`
    // and `await`ing the result.
    PromiseUtil.handleRejection(this.#run());
    return this.whenStarted();
  }

  /** @override */
  async stop() {
    if (!this.isRunning()) {
      return null;
    }

    this.#runningCondition.value = false;
    return this.#run(true);
  }

  /** @override */
  async whenStarted() {
    if (!this.isRunning()) {
      return null;
    }

    return this.#startResult;
  }

  /**
   * Runs the thread if it's not already running, or just returns the promise
   * for the current run-in-progress.
   *
   * @param {boolean} [exposed] Should the returned promise be considered
   *   "exposed" to the client of this instance?
   * @returns {Promise} The (eventual) result of the run.
   */
  #run(exposed = false) {
    if (!this.isRunning()) {
      this.#runningCondition.value = true;
      this.#runResult              = this.#run0();
    }

    this.#runResultExposed ||= exposed;
    return this.#runResult;
  }

  /**
   * Does the main work of running the thread. This is a separate method from
   * {@link #run0} exactly so that we can capture the promise for the result of
   * the run.
   *
   * @returns {*} Whatever the main function returned.
   * @throws {Error} The same error as was thrown by either the start function
   *   or main function, if indeed one of those threw an error.
   */
  async #run0() {
    // We call `start()` here, before the `await` below, so that `startResult`
    // becomes non-null synchronously with respect to the client call to
    // (public) `run()`. Note that we do this even if there is no start
    // function, so that `whenStarted()` can honor its contract.
    this.#startResult = this.#start();

    let started = false;

    try {
      // This `await` guarantees (a) that no thread processing happens
      // synchronously with respect to the client, and (b) that the start
      // function will have finished before we call the main function.
      await this.#startResult;
      started = true;

      // `func ?? null` is a tactic to call it without binding `this`.
      return await (this.#mainFunction ?? null)(this.#runnerAccess);
    } catch (error) {
      if (started && !this.#runResultExposed) {
        // There was an exception while running, and `#runResult` was never
        // exposed to a client of this instance, which means there is no way for
        // it to have caught the error about to be thrown from this method. So,
        // we now _force_ an unhandled promise rejection.
        Promise.reject(
          new Error(
            'Threadlet threw exception with no possible handler',
            { cause: error }));
      }
      throw error;
    } finally {
      // Slightly tricky: At this moment, `#runResult` is the return promise
      // from this very method, but it's correct to `null` it out now, because
      // as of the end of this method (which will be happening synchronously),
      // running will have stopped. Similar logic applies to the other
      // properties.
      this.#startResult            = null;
      this.#runResultExposed       = false;
      this.#runResult              = null;
      this.#runningCondition.value = false;
    }
  }

  /**
   * Runs the start function.
   *
   * @returns {*} Whatever the start function returned, or `null` if there is no
   *   start function.
   * @throws {Error} The same error as was thrown by the start function, if it
   *   indeed threw an error.
   */
  async #start() {
    if (this.#startFunction) {
      // This `await` guarantees that the start function isn't called
      // synchronously with respect to the client (which called `run()`). (This
      // guarantee is specified by this class.)
      await null;

      // `func ?? null` is a tactic to call it without binding `this`.
      return (this.#startFunction ?? null)(this.#runnerAccess);
    } else {
      return null;
    }
  }


  //
  // Static members
  //

  /**
   * Class that provides access to internal state in a form that's useful for
   * `start()` and `run()` functions.
   */
  static RunnerAccess = class RunnerAccess {
    /**
     * The outer instance.
     *
     * @type {Threadlet}
     */
    #outerThis;

    /**
     * The `#runningCondition` from {@link #outerThis}.
     *
     * @type {Condition}
     */
    #outerRunCond;

    /**
     * Constructs an instance.
     *
     * @param {Threadlet} outerThis The outer instance.
     */
    constructor(outerThis) {
      this.#outerThis    = outerThis;
      this.#outerRunCond = outerThis.#runningCondition;
      Object.freeze(this);
    }

    /**
     * @returns {Threadlet} The `Threadlet` instance which this instance
     *   provides access to.
     */
    get threadlet() {
      return this.#outerThis;
    }

    /**
     * Runs a `Promise.race()` between the result of {@link #whenStopRequested}
     * and the given additional promises.
     *
     * @param {Array<*>} promises Array (or iterable in general) of promises to
     *   race.
     * @returns {boolean} `true` iff this instance has been asked to stop
     *  (as with {@link #shouldStop}), if the race was won by a non-rejected
     *  promise.
     * @throws {*} The rejected result of the promise that won the race.
     */
    async raceWhenStopRequested(promises) {
      if (this.shouldStop()) {
        return true;
      }

      // List our stop condition last, because it is likely to be unresolved; we
      // thus might get to avoid some work in the call to `race()`.
      const allProms = [...promises, this.#outerRunCond.whenFalse()];

      await PromiseUtil.race(allProms);

      return this.shouldStop();
    }

    /**
     * Should the current run stop?
     *
     * @returns {boolean} `true` iff this instance has been asked to stop.
     */
    shouldStop() {
      return this.#outerRunCond.value === false;
    }

    /**
     * Gets a promise that becomes fulfilled when this instance has been asked
     * to stop (or when it is already stopped).
     *
     * @returns {Promise} A promise as described.
     */
    whenStopRequested() {
      return this.#outerRunCond.whenFalse();
    }
  };
}
