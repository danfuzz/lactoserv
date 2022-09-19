// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent } from '#x/ChainedEvent';
import { ManualPromise } from '#x/ManualPromise';
import { Mutex } from '#x/Mutex';

import { MustBe } from '@this/typey';


// Implementation note:
//
// Arguably surprisingly, JavaScript runs `async` functions synchronously up to
// the point of the first `await`. This notably means that an `async` method can
// update instance state synchronously. The implementation here takes advantage
// of that fact (as noted in the code).

/**
 * Event tracker, which makes it convenient to walk down a chain of {@link
 * ChainedEvent} instances. This class strictly _consumes_ events; it does not
 * produce them. This class functions approximately as an iterator over an event
 * chain, but implements much more than the basic iterator functionality.
 *
 * **Note:** Instances of this class can be responsible for garbage accumulation
 * of event instances in the case where (a) an instance of this class is not
 * itself garbage, (b) nothing is "servicing" it, so it never advances through
 * the chain, and (c) there is a source which continues emitting events on the
 * chain.
 */
export class EventTracker {
  /**
   * @type {?Promise<ChainedEvent>} Promise for the first event on the chain,
   * when appropriate.
   */
  #firstPromise = null;

  /** @type {?ChainedEvent} Head of (first event on) the chain, if known. */
  #headNow = null;

  /** @type {?Error} Error which "broke" this instance, if any. */
  #brokenReason = null;

  #advanceMutex = new Mutex();

  #advanceHead = null;
  #advancerCount = 0;

  /**
   * @type {?AdvanceRecord[]} Queue of advances to perform, or `null` if
   * advancing is not currently (asynchronously) in progress.
   */
  #advances = null;

  /**
   * Constructs an instance.
   *
   * @param {ChainedEvent|Promise<ChainedEvent>} firstEvent First event on the
   *   tracked chain, or promise to same.
   */
  constructor(firstEvent) {
    if (firstEvent instanceof Promise) {
      this.#firstPromise = firstEvent;
      // This causes `firstEvent` to get `await`ed, so `#headNow` will actually
      // get set when `firstEvent` resolves.
      this.advance(0);
    } else if (firstEvent instanceof ChainedEvent) {
      this.#headNow = firstEvent;
    } else {
      throw new Error('Invalid value for `firstEvent`.');
    }
  }

  // TODO: Rename `first` -> `peek` etc.
  /**
   * @returns {Promise<ChainedEvent>} Promise for the first (earliest-known)
   * event tracked by this instance. This is an immediately-resolved promise in
   * all cases _except_ when either (a) this instance has yet to observe an
   * event, or (b) it is {@link #advance}d past the end of the chain.
   * @throws {Error} Thrown if this instance somehow became broken.
   */
  get first() {
    if (this.#brokenReason) {
      throw this.#brokenReason;
    }

    if (this.#firstPromise === null) {
      // When `#firstPromise` is `null`, `#headNow` is always supposed to be a
      // valid event.
      this.#firstPromise = Promise.resolve(this.#headNow);
    }

    return this.#firstPromise;
  }

  /**
   * @returns {?ChainedEvent} Head event of this instance (first event which is
   * not yet consumed from this instance's event source), if known. This is
   * non-`null` in all cases _except_ when either (a) this instance has yet to
   * observe an event, or (b) it is {@link #advance}d past the end of the chain.
   * @throws {Error} Thrown if this instance somehow became broken.
   */
  get headNow() {
    if (this.#brokenReason) {
      throw this.#brokenReason;
    }

    return this.#headNow;
  }

  /**
   * Advances this instance -- possibly zero times -- to a point where {@link
   * #headNow} is (or will necessarily become) satisfied by the given predicate.
   * Predicate options:
   *
   * * `null` -- Advances past exactly one event. This the default (and is the
   *   same as specifying `1`.)
   * * `count: number` -- Advances past `count` events. Allowed to be `0`.
   * * `type: string` -- Advances until `headNow.type` is the given `type`.
   *   (This assumes `type` is bound by all events on the chain.)
   * * `predicate: function(ChainedEvent): boolean` -- General predicate-per-se,
   *   which should return `true` for a matching event.
   *
   * It is possible to use this method to advance the instance past the end of
   * the "settled" chain, in which case {@link #headNow} will become `null`, and
   * the tracked source will need to emit one or more events before
   * {@link #headNow} becomes non-`null` again.
   *
   * Though this method is `async`, if the request can be satisfied
   * synchronously, it will. In such cases, the return value will still be a
   * promise (as it must be given this method is declared `async`), but
   * `#headNow` will synchronously reflect the updated state of affairs.
   *
   * **Note:** If the predicate throws an error -- even synchronously -- the
   * error becomes manifest by the state of the instance becoming broken.
   *
   * @param {null|number|string|function(*)} predicate Predicate to satisfy.
   * @returns {ChainedEvent} What {@link #headNow} is (or would have been) at
   *   the moment the advancing is complete.
   * @throws {Error} Thrown if there was any trouble. If so, the instance will
   *   also be permanently broken, with most methods also throwing.
   */
  async advance(predicate = null) {
    let adv;

    if (this.#advanceHead) {
      // There is already an advance-queue to chain off of.
      adv = new AdvanceRecord(null, this.#advanceHead.resultHeadPromise, predicate);
    } else {
      // There is no advance-queue (yet).
      adv = new AdvanceRecord(this.#headNow, this.#firstPromise, predicate);
      if (this.#headNow) {
        // The head event is synchronously known.
        try {
          if (adv.handleSync()) {
            // We found the event we were looking for. Because everything before
            // this point is run _synchronously_ with respect to the caller (see
            // note at the top of the file), when the method synchronously returns
            // here, `#headNow` will actually be the non-`null` result of the
            // action, even though (being `async`) the return value will still be
            // a promise.
            this.headNow      = adv.headNow;
            this.firstPromise = adv.headPromise;
            return this.#headNow;
          }
        } catch (e) {
          throw this.#becomeBroken(e);
        }
      }
    }

    // Note: `adv` already links to the old `#advanceHead` if it was set,
    // because of the top of the `if` above.
    this.#advanceHead  = adv;
    this.#headNow      = null;
    this.#firstPromise = adv.resultHeadPromise;

    // This is the first `await` in the method. Everything in this method up to
    // this point ran synchronously with respect to our caller.
    try {
      await adv.handleAsync();
    } catch (e) {
      throw this.#becomeBroken(e);
    }

    if (this.#advanceHead === adv) {
      // This call is the last pending advance (at the moment, at least), so we
      // get to settle things back down.
      this.#headNow      = adv.headNow;
      this.#firstPromise = adv.headPromise;
      this.#advanceHead  = null;
    }

    // Note: *Not* this instance's `#headNow` here, because that might still be
    // `null` due to pending `advance()`s.
    return adv.headNow;
  }

  #becomeBroken(reason) {
    if (this.#brokenReason) {
      if (reason !== this.#brokenReason) {
        console.log('Ignoring `becomeBroken()`, because already broken!');
      }
      return this.#brokenReason;
    }

    this.#brokenReason  = reason;
    this.#headNow       = null;
    this.#firstPromise  = null;
    this.#advancerCount = 0;

    return reason;
  }
}

class AdvanceRecord {
  #headNow;
  #headPromise;
  #done         = false;
  #count        = null;
  #predicate    = null;
  #resultHeadResolver = null;

  constructor(headNow, headPromise, predicate) {
    this.#headNow     = headNow;
    this.#headPromise = headPromise;

    let error = 0;

    switch (typeof predicate) {
      case 'object': {
        if (predicate !== null) {
          error = 1;
        }
        this.#count = 1;
        break;
      }
      case 'number': {
        const count = predicate;
        if ((count < 0) || (count !== Math.trunc(count))) {
          error = 1;
        }
        this.#count = count;
        break;
      }
      case 'string': {
        const name = predicate;
        this.#predicate = (event => event.name === name);
        break;
      }
      case 'function': {
        this.#predicate = MustBe.callableFunction(predicate);
        break;
      }
    }

    if (error) {
      throw new Error('Invalid value for `predicate`.');
    }
  }

  get headNow() {
    return this.#headNow;
  }

  get headPromise() {
    return this.#headPromise;
  }

  get done() {
    return this.#done;
  }

  get resultHeadPromise() {
    if (!this.#resultHeadResolver) {
      this.#resultHeadResolver = new ManualPromise();
    }

    return this.#resultHeadResolver.promise;
  }

  handleSync() {
    if (this.#done) {
      this.#becomeDone();
    } else if (this.#headNow) {
      try {
        const done = (this.#count !== null)
          ? this.#handleCount()
          : this.#handlePredicate();
        if (done) {
          this.#becomeDone();
        }
      } catch (e) {
        this.#becomeDone(e);
      }
    }

    return this.#done;
  }

  async handleAsync() {
    while (!this.#done) {
      if (!this.#headNow) {
        await this.#resolveHeadNow();
      }

      this.handleSync();
    }

    if (!this.#headNow) {
      // Somewhat special case: We've found ourselves definitely-done, but
      // without a settled `headNow`. (This can happen when an instance of
      // `EventTracker` was constructed with a promise for its first event, and
      // also when `EventTracker.advance()` is used to skip over events that
      // have yet to be emitted.) We `await` to get it settle, so our caller can
      // in turn have a value to plumb through as appropriate.
      await this.#resolveHeadNow();
    }
  }

  async #resolveHeadNow() {
    try {
      const headNow = await this.#headPromise;
      if (!(headNow instanceof ChainedEvent)) {
        throw new Error('Invalid event value.');
      }
      this.#headNow = headNow;
    } catch (e) {
      this.#becomeDone(e);
    }
  }

  #becomeDone(error = null) {
    this.#done = true;

    const resolver = this.#resultHeadResolver;

    if (resolver && !resolver.isSettled()) {
      if (error) {
        resolver.reject(error);
      } else {
        resolver.resolve(this.#headPromise);
      }
    }

    if (error) {
      throw error;
    }
  }

  #handleCount() {
    while ((this.#count > 0) && this.#headNow) {
      const nextNow = this.#headNow.nextNow;
      if (!nextNow) {
        this.#headPromise = this.#headNow.next;
      }
      this.#headNow = nextNow;
      this.#count--;
    }

    return (this.#count === 0);
  }

  #handlePredicate() {
    while (this.#headNow) {
      if (this.#predicate(this.#headNow)) {
        return true;
      }

      const nextNow = this.#headNow.nextNow;
      if (!nextNow) {
        this.#headPromise = this.#headNow.next;
      }
      this.#headNow = nextNow;
    }

    return false;
  }
}
