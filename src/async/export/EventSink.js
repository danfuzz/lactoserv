// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { EventOrPromise } from '#p/EventOrPromise';
import { LinkedEvent } from '#x/LinkedEvent';
import { Threadlet } from '#x/Threadlet';


/**
 * Event sink for {@link LinkedEvent}. Instances of this class "consume"
 * events, calling on a specified processing function for each. Instances can be
 * started and stopped (this class is a sublcass of {@link Threadlet}), and
 * while running they are always either processing existing events or waiting
 * for new events to be emitted on the chain they track.
 */
export class EventSink extends Threadlet {
  /** @type {function(LinkedEvent)} Function to call, to process each event. */
  #processor;

  /**
   * @type {EventOrPromise} Head of the event chain, representing the earliest
   * event which has not yet been processed.
   */
  #head;

  /**
   * @type {boolean} Is this instance eagerly "draining" all synchronously-known
   * events?
   */
  #draining = false;

  /**
   * Constructs an instance. It is initally _not_ running.
   *
   * @param {function(LinkedEvent)} processor Function to call, to process
   *   each event. This function is always called asynchronously.
   * @param {LinkedEvent|Promise<LinkedEvent>} firstEvent First event to be
   *   processed by the instance, or promise for same.
   */
  constructor(processor, firstEvent) {
    super(() => this.#run());

    this.#processor = MustBe.callableFunction(processor).bind(null);
    this.#head      = new EventOrPromise(firstEvent);
  }

  /**
   * @returns {Promise<LinkedEvent>} Promise for the first event which has not
   * yet been processed by this instance.
   */
  get currentEvent() {
    return this.#head.eventPromise;
  }

  /**
   * "Drain" the event chain by processing all synchronously-known events, and
   * then stop processing.
   *
   * @throws {Error} Thrown if there was any trouble processing or stopping.
   */
  async drainAndStop() {
    this.#draining = true;
    return this.stop();
  }

  /**
   * Gets the current head event -- possibly waiting for it -- or returns `null`
   * if the instance has been asked to stop.
   *
   * @returns {?LinkedEvent} The current head event.
   * @throws {Error} Thrown if there is any trouble getting the event.
   */
  async #headEvent() {
    for (let pass = 1; pass <= 2; pass++) {
      if (pass === 2) {
        // On the second pass, wait for something salient to happen. (On the
        // first pass, waiting would achieve nothing but inefficiency.)
        await this.raceWhenStopRequested([this.#head.eventPromise]);
      }

      if (!this.#draining && this.shouldStop()) {
        return null;
      }

      const eventNow = this.#head.eventNow;
      if (eventNow) {
        return eventNow;
      }
    }

    // We only end up here if we've been asked to stop, and _either_ we haven't
    // been asked to drain _or_ the event chain is in fact fully drained.
    return null;
  }

  /**
   * Main thread body: Processes events as they become available, until a
   * problem is encountered or we're requested to stop.
   */
  async #run() {
    this.#draining = false;

    for (;;) {
      if (await this.#runStep()) {
        return null;
      }
    }
  }

  /**
   * Helper for {@link #run}, which performs one iteration of the inner loop.
   *
   * @returns {boolean} Done flag: if `true`, the caller of this method should
   *   itself return.
   */
  async #runStep() {
    // This is a separate method only because _not_ doing so can trigger a bug
    // in V8 (found in v10.8.168.25 as present in Node v19.7.0), wherein
    // attaching a debugger can cause a permanent leak of a local variable's
    // instantaneous value in a loop that uses `async`.

    const event = await this.#headEvent();
    if (!event) {
      return true;
    }

    try {
      await this.#processor(event);
    } finally {
      this.#head = this.#head.next;
    }

    return false;

    // Just for the record, here's the original `#run()`:
    //
    // async #run() {
    //   this.#draining = false;
    //
    //   for (;;) {
    //     const event = await this.#headEvent();
    //     if (!event) {
    //       break;
    //     }
    //
    //     try {
    //       await this.#processor(event);
    //     } finally {
    //       this.#head = this.#head.next;
    //     }
    //   }
    //
    //   return null;
    // }
  }
}
