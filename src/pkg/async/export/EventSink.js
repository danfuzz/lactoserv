// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';

import { ChainedEvent } from '#x/ChainedEvent';
import { EventOrPromise } from '#p/EventOrPromise';
import { Threadoid } from '#x/Threadoid';


/**
 * Event sink for {@link ChainedEvent}. Instances of this class "consume"
 * events, calling on a specified processing function for each. Instances can be
 * started and stopped, and while running are always either processing existing
 * events or waiting for new events to be emitted on the chain they track.
 */
export class EventSink {
  /** @type {function(ChainedEvent)} Function to call, to process each event. */
  #processor;

  /**
   * @type {EventOrPromise} Head of the event chain, representing the earliest
   * event which has not yet been processed.
   */
  #head;

  /** @type {Threadoid} Thread that runs the processor function. */
  #thread;


  /**
   * Constructs an instance. It is initally _not_ running.
   *
   * @param {function(ChainedEvent)} processor Function to call, to process
   *   each event. This function is always called asynchronously.
   * @param {ChainedEvent|Promise<ChainedEvent>} firstEvent First event to be
   *   processed by the instance, or promise for same.
   */
  constructor(processor, firstEvent) {
    this.#processor = MustBe.callableFunction(processor).bind(null);
    this.#head      = new EventOrPromise(firstEvent);
    this.#thread    = new Threadoid(() => this.#run());
  }

  /**
   * Starts this instance running, if it isn't already. The return value or
   * exception thrown from this method indicates "why" the instance stopped.
   * All event processing happens asynchronously with respect to the caller of
   * this method.
   *
   * @returns {null} Indicates that the instance stopped because it was asked
   *   to.
   * @throws {Error} Thrown to indicate a problem while running. This is most
   *   likely an error thrown by the client-supplied processor function.
   */
  async run() {
    return this.#thread.run();
  }

  /**
   * Requests that this instance stop running after finishing processing any
   * event it is in the middle of handling.
   */
  stop() {
    this.#thread.stop();
  }

  /**
   * Processes events as they become available, until a problem is encountered
   * or we're requested to stop.
   */
  async #run() {
    for (;;) {
      const event = await this.#headEvent();
      if (!event) {
        break;
      }

      try {
        await this.#processor(event);
      } finally {
        this.#head = this.#head.next;
      }
    }

    return null;
  }

  /**
   * Gets the current head event -- possibly waiting for it -- or returns `null`
   * if the instance has been asked to stop.
   *
   * @returns {?ChainedEvent} The current head event.
   * @throws {Error} Thrown if there is any trouble getting the event.
   */
  async #headEvent() {
    if (this.#thread.shouldStop()) {
      return null;
    }

    const eventNow = this.#head.eventNow;

    if (eventNow) {
      return eventNow;
    }

    const result = await Promise.race([
      this.#head.eventPromise,
      this.#thread.whenStopRequested()
    ]);

    if (this.#thread.shouldStop()) {
      return null;
    }

    return result;
  }
}
