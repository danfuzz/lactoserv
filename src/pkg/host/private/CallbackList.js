// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as timers from 'node:timers/promises';

import { Condition } from '@this/async';

import { ThisModule } from '#p/ThisModule';


/** @type {function(...*)} Logger for this class. */
const logger = ThisModule.logger.callback;

/**
 * List of callbacks to be managed and (perhaps) actually run.
 */
export class CallbackList {
  /** @type {function(...*)} Instance-specific logger. */
  #logger;

  /** @type {number} Maximum time for running all callbacks, in msec. */
  #maxRunMsec;

  /** @type {(function())[]} Callbacks to invoke when requested. */
  #callbacks = [];

  /** @type {Condition} Callbacks currently in-progress? */
  #inProgress = new Condition();

  /**
   * Constructs an instance.
   *
   * @param {string} name Name of the instance, for logging purposes.
   * @param {number} maxRunMsec Maximum time for running all callbacks, in msec.
   */
  constructor(name, maxRunMsec) {
    this.#logger     = logger[name];
    this.#maxRunMsec = maxRunMsec;
  }

  /**
   * Registers a callback.
   *
   * @param {function()} callback The callback.
   */
  register(callback) {
    this.#callbacks.push(callback);
  }

  /**
   * Runs all the callbacks. This method will only ever be run once at a time.
   *
   * @throws {Error} Thrown if there was any trouble with the run.
   */
  async run() {
    if (this.#inProgress.value) {
      // Already running. Ignore the request.
      this.#logger.ignoring();
      return;
    }

    this.#inProgress.value = true;

    this.#logger.running();

    try {
      await this.#run0();
    } catch (e) {
      this.#logger.error(e);
      throw e;
    } finally {
      this.#logger.done();
      this.#inProgress.value = false;
    }
  }

  /**
   * The inner implementation of {@link #run}.
   */
  async #run0() {
    const abortCtrl = new AbortController();

    const callProm = (async () => {
      const settled = Promise.allSettled(this.#callbacks.map(async (cb) => cb()));

      const results = await settled; // Wait for the result to be ready.
      abortCtrl.abort();             // Immediately cancel the timeout.

      let rejectedCount = 0;
      for (const result of results) {
        if (result.status === 'rejected') {
          rejectedCount++;
          this.#logger.error(result.reason);
        }
      }

      if (rejectedCount !== 0) {
        const plural = (rejectedCount === 1) ? '' : 's';
        throw new Error(`Error${plural} from ${rejectedCount} callback${plural}.`);
      }
    })();

    const timeoutProm = (async () => {
      const timeout = timers.setTimeout(
        this.#maxRunMsec, null, { signal: abortCtrl.signal });
      try {
        await timeout;
      } catch (e) {
        // If the timeout was aborted, just swallow the "error", and let the
        // system continue to run in peace. But for anything else, rethrow,
        // which then percolates out from the `await...all` below.
        if (e?.code === 'ABORT_ERR') {
          return;
        } else {
          throw e;
        }
      }

      // Similar to above, throw an error to indicate timeout.
      this.#logger.timedOut();
      throw new Error(`Timed out during callback handler!`);
    })();

    // This waits for both blocks above to complete without error, or for one to
    // throw an error. By the nature of the arrangement, both will complete
    // promptly once the first one (the callback calls) finishes, whether with
    // or without error.
    await Promise.all([timeoutProm, callProm]);
  }
}
