// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent } from '#x/ChainedEvent';
import { ManualPromise } from '#x/ManualPromise';

import { MustBe } from '@this/typey';


// TODO:
// * next() -- it's `advance(x)` immediately followed by `advance(1)` to consume
//   the found item.
// * nextSync()
// * peek() -- it's `advance(x)` to find an event but without consuming it.
//   Performed with respect to any `advance()`s that have already been queued
//   up.
// * peekSync() -- Only possible to work when `headNow` is known.
//
// Maybe:
// * withPushedHead()
// * withReplacedHead() (uses `event.withPayload()``)

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
   * @type {?ChainedEvent} Head of (first event on) the chain, if known. If this
   * is `null`, then {@link #headPromise} will be non-`null`.
   */
  #headNow = null;

  /**
   * @type {?Promise<ChainedEvent>} Promise for the head of (first event on) the
   * chain, if there is indeed such a promise around. If this is `null`, then
   * {@link #headNow} will be non-`null`.
   */
  #headPromise = null;

  /** @type {?Error} Error which "broke" this instance, if any. */
  #brokenReason = null;

  /**
   * @type {?AdvanceAction} The latest action to perform, if any. When `null`,
   * no action is currently (asynchronously) in progress. (Other actions that
   * are taking place / to take place before this one are linked via the
   * action's `headPromise`.)
   */
  #actionHead = null;

  /**
   * Constructs an instance.
   *
   * @param {ChainedEvent|Promise<ChainedEvent>} firstEvent First event on the
   *   tracked chain, or promise to same.
   */
  constructor(firstEvent) {
    this.#setHead(firstEvent);
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
   * @returns {Promise<ChainedEvent>} Promise for the -- often not-yet-known --
   * value of {@link #headNow}. This is an immediately-resolved promise in all
   * cases _except_ when either (a) this instance has yet to observe an event,
   * or (b) it is {@link #advance}d past the end of the chain.
   * @throws {Error} Thrown if this instance somehow became broken.
   */
  get headPromise() {
    if (this.#brokenReason) {
      throw this.#brokenReason;
    }

    if (this.#headPromise === null) {
      // When `#headPromise` is `null`, `#headNow` is always supposed to be a
      // valid event.
      this.#headPromise = Promise.resolve(this.#headNow);
    }

    return this.#headPromise;
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
   * @param {null|number|string|function(*)} [predicate = null] Predicate to
   *   satisfy.
   * @returns {ChainedEvent} What {@link #headNow} is (or would have been) at
   *   the moment the advancing is complete.
   * @throws {Error} Thrown if there was any trouble. If so, and the trouble was
   *   anything other than an invalid `predicate`, the instance will also become
   *   permanently broken, with most methods also throwing.
   */
  async advance(predicate = null) {
    predicate = EventTracker.#validateAndTransformPredicate(predicate);

    if (this.#brokenReason) {
      throw this.#brokenReason;
    }

    let action;

    if (this.#actionHead) {
      // There is already an action queue to chain off of.
      action = new AdvanceAction(null, this.#actionHead.resultHeadPromise, predicate);
    } else {
      // There is no advance-queue (yet).
      action = new AdvanceAction(this.#headNow, this.#headPromise, predicate);
      if (this.#headNow) {
        // The head event is synchronously known.
        try {
          if (action.handleSync()) {
            // We found the event we were looking for. Because everything before
            // this point is run _synchronously_ with respect to the caller (see
            // note at the top of the file), when the method synchronously
            // returns here, `#headNow` and `#headPromise` will actually be
            // the result of the completed action, even though (being `async`)
            // the return value from this method will still be a promise.
            this.#setHead(action.result);
            return action.result;
          }
        } catch (e) {
          throw this.#becomeBroken(e);
        }
      }
    }

    // Note: `action` already links to the old `#actionHead` if it was set,
    // because of the top of the `if` above.
    this.#actionHead  = action;
    this.#headNow     = null;
    this.#headPromise = action.resultHeadPromise;

    // This is the first `await` in the method. Everything in this method up to
    // this point ran synchronously with respect to our caller.
    try {
      await action.handleAsync();
    } catch (e) {
      throw this.#becomeBroken(e);
    }

    if (this.#actionHead === action) {
      // This call is the last pending advance (at the moment, at least), so we
      // get to settle things back down.
      this.#setHead(action.result);
      this.#actionHead = null;
    }

    // Note: *Not* this instance's `#headNow` here, because that might still be
    // `null` due to pending `advance()`s.
    return action.result;
  }

  /**
   * Advances the head of this instance -- or at least initiates it -- with the
   * exact same semantics as {@link #advance}, but (a) synchronously returns the
   * result of a synchronously-successful operation, and (b) ensures that no
   * exception is thrown asynchronously direcly from this method even if the
   * operation ultimately fails.
   *
   * Context: Even though {@link #advance} can succeed synchronously, it _might_
   * throw, and if it _does_ throw, it will be asynchronously. In such cases, a
   * _synchronous_ call to it that doesn't attempt to deal with the return value
   * will ultimately cause an unhandled promise rejection to show up at the top
   * level. Using this method ensures that that won't happen. The instance will
   * still ultimately become broken, though, which is (presumably) a desirable
   * outcome.
   *
   * @param {null|number|string|function(*)} [predicate = null] Predicate to
   *   satisfy.
   * @returns {?ChainedEvent} The synchronously-known {@link #headNow} from the
   *   successful result of the operation if it was indeed synchronously
   *   successful, or `null` if either it needs to perform asynchronous
   *   operations or if it failed synchronously.
   * @throws {Error} Thrown if `predicate` is invalid.
   */
  advanceSync(predicate = null) {
    predicate = EventTracker.#validateAndTransformPredicate(predicate);

    if (this.#brokenReason) {
      // Throwing the reason would be against the contract of this method. The
      // caller can determine brokenness via other means.
      return null;
    }

    const result = this.advance(predicate);

    if (this.#headNow) {
      // The `advance()` call succeeded synchronously.
      return this.#headNow;
    }

    // The `advance()` call either failed synchronously or needs to do
    // asynchronous work. In either case, we now need to swallow its result, so
    // as to squelch a promise rejection, should it happen.
    (async () => {
      try {
        await result;
      } catch {
        // Ignore it. (See above.)
      }
    })();

    return null;
  }

  /**
   * Makes this instance become "broken" with the indicated reason. After
   * calling this method, the instance will respond to most method calls by
   * throwing the reason. And once broken, and instance won't ever become
   * un-broken.
   *
   * @param {Error} reason The cause of the breakage.
   * @returns {Error} The same `reason` as given.
   */
  #becomeBroken(reason) {
    if (this.#brokenReason) {
      if (reason !== this.#brokenReason) {
        // It's expected that the same breakage reason will come in via multiple
        // channels, so only make noise if there's a different reason than the
        // one we've already seen.
        console.log('Ignoring `becomeBroken()`, because already broken!');
      }
    } else {
      this.#brokenReason = reason;
      this.#headNow      = null;
      this.#headPromise  = null;
      this.#actionHead   = null;
    }

    return reason;
  }

  /**
   * Sets {@link #headNow} and {@link #headPromise}, arranging for `headNow` to
   * get resolved if given a promise, and also arranging for the instance to
   * break if given a promise that becomes rejected.
   *
   * This method is intended never to `throw` in response to a resolution
   * problem, instead just to cause the instance to become broken. This is
   * because the method is called in contexts where throwing would inevitably
   * result in an unhandled promise rejection.
   *
   * @param {ChainedEvent|Promise<ChainedEvent>} event New head of the chain.
   * @throws {Error} Thrown if `event` is not a valid value.
   */
  #setHead(event) {
    if (this.#brokenReason) {
      // Nothing to do; already broken.
      return;
    }

    if (event instanceof ChainedEvent) {
      this.#headNow     = event;
      this.#headPromise = null;
    } else if (event instanceof Promise) {
      // We resolve the promise in an "async-aside" to achieve the specified
      // no-throw behavior. And we only store back if the instance hasn't yet
      // advanced onward or become broken in the mean time. Also note that we
      // can't store `event` directly into `#headPromise`, because it might not
      // resolve to a valid value, and we maintain a guarantee about the
      // validity of what that resolves to.
      const mp = new ManualPromise();
      this.#headNow     = null;
      this.#headPromise = mp.promise;
      (async () => {
        try {
          const headNow = await event;
          if (headNow instanceof ChainedEvent) {
            mp.resolve(headNow);
          } else {
            throw new Error('Invalid event value.');
          }
          if ((this.#headPromise === mp.promise) && !this.#brokenReason) {
            this.#headNow = headNow;
          }
        } catch (e) {
          this.#becomeBroken(e);
          mp.rejectAndHandle(e);
        }
      })();
    } else {
      throw new Error('Invalid event value.');
    }
  }


  //
  // Static members
  //

  /**
   * Validates and appropriately-transforms a predicate as defined by {@link
   * #advance} and {@link #advanceSync}
   *
   * @param {null|number|string|function(*)} predicate Predicate to satisfy.
   * @returns {number|function(*): boolean} The validated / transformed result.
   * @throws {Error} Thrown if `predicate` is not one of the allowed forms.
   */
  static #validateAndTransformPredicate(predicate) {
    switch (typeof predicate) {
      case 'object': {
        if (predicate === null) {
          return 1;
        }
        break;
      }
      case 'number': {
        const count = predicate;
        if ((count >= 0) && (count === Math.trunc(count))) {
          return count;
        }
        break;
      }
      case 'string': {
        const type = predicate;
        return (event => event.type === type);
      }
      case 'function': {
        return MustBe.callableFunction(predicate);
      }
    }

    throw new Error('Invalid value for `predicate`.');
  }
}

/**
 * Helper for {@link #EventTracker.advance}, which implements the guts of the
 * method.
 *
 * **Note:** Exactly one of {@link #count} or {@link #predicate} will be
 * non-`null` in any given instance. (This avoids a trivial-ish subclassing
 * situation.)
 */
class AdvanceAction {
  /**
   * @type {?number} Remaining count of events to skip, if in fact this instance
   * is skipping events.
   */
  #count = null;

  /**
   * @type {?function(*): boolean} Predicate which an event needs to satisfy for
   * the operation to be considered complete, if in fact this instance is
   * predicate-based.
   */
  #predicate = null;

  /**
   * {?ChainedEvent|Promise<ChainedEvent>} Ultimate result of this operation, if
   * indeed it has completed.
   */
  #result = null;

  /**
   * {?ManualPromise} Resolver which is to be sent the ultimate result of this
   * operation, if needed.
   */
  #resultHeadResolver = null;

  /**
   * @type {?ChainedEvent} Event chain head from the perspective of the
   * in-progress operation.
   */
  #headNow;

  /**
   * @type {?Promise<ChainedEvent>} Promise for {@link #headNow}, when that
   * property isn't synchronously known.
   */
  #headPromise;

  /**
   * Constructs an instance.
   *
   * @param {?ChainedEvent} headNow Event chain head at which to start.
   * @param {?Promise<ChainedEvent>} headPromise Promise for the event chain
   *   head.
   * @param {number|function(*): boolean} predicate Predicate. See {@link
   *   #EventTracker.advance} for details.
   */
  constructor(headNow, headPromise, predicate) {
    this.#headNow     = headNow;
    this.#headPromise = headPromise;

    if (typeof predicate === 'number') {
      this.#count = predicate;
    } else {
      this.#predicate = predicate;
    }
  }

  /**
   * @returns {?ChainedEvent|Promise<ChainedEvent>} Ultimate result of this
   * operation, if available.
   */
  get result() {
    return this.#result;
  }

  /**
   * @returns {Promise<ChainedEvent>} Promise for the ultimate result of this
   * operation.
   */
  get resultHeadPromise() {
    if (!this.#resultHeadResolver) {
      this.#resultHeadResolver = new ManualPromise();
    }

    return this.#resultHeadResolver.promise;
  }

  /**
   * Does as much of this operation as possible synchronously.
   *
   * @returns {boolean} `true` iff the operation has been completed.
   * @throws {Error} Thrown if there was any trouble at all. And if thrown, the
   *   same error is propagated to {@link #resultHeadPromise} if it was ever
   *   retrieved.
   */
  handleSync() {
    if (this.#result) {
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

    return this.#result !== null;
  }

  /**
   * Completes this operation -- or dies trying -- asynchronously.
   *
   * @throws {Error} Thrown if there was any trouble at all. And if thrown, the
   *   same error is propagated to {@link #resultHeadPromise} if it was ever
   *   retrieved.
   */
  async handleAsync() {
    while (!this.handleSync()) {
      if (!this.#headNow) {
        await this.#resolveHeadNow();
      }
    }
  }

  /**
   * Advances to the next event in the chain, maintaining parallel-correct
   * values for both {@link #headNow} and {@link #headPromise}.
   */
  #advanceToNext() {
    const nextNow = this.#headNow.nextNow;

    if (nextNow) {
      this.#headNow     = nextNow;
      this.#headPromise = null;
    } else {
      this.#headPromise = this.#headNow.nextPromise;
      this.#headNow     = null;
    }
  }

  /**
   * Marks the operation as done, possibly due to a problem. If there is a
   * {@link #resultHeadResolver}, it is informed of the result or the problem.
   *
   * @param {?Error} error The problem, if any. If non-`null`, this method will
   *   throw the same error in addition to propagating it to the result promise.
   */
  #becomeDone(error = null) {
    this.#result = this.#headNow ?? this.#headPromise;

    const resolver = this.#resultHeadResolver;

    if (resolver && !resolver.isSettled()) {
      if (error) {
        resolver.rejectAndHandle(error);
      } else {
        resolver.resolve(this.#result);
      }
    }

    if (error) {
      throw error;
    }
  }

  /**
   * Does the core work of walking the event chain, when {@link #count} is
   * being used.
   *
   * @returns {boolean} `true` iff the operation was completed.
   */
  #handleCount() {
    while ((this.#count > 0) && this.#headNow) {
      this.#advanceToNext();
      this.#count--;
    }

    return (this.#count === 0);
  }

  /**
   * Does the core work of walking the event chain, when {@link #predicate} is
   * being used.
   *
   * @returns {boolean} `true` iff the operation was completed.
   */
  #handlePredicate() {
    while (this.#headNow) {
      if (this.#predicate(this.#headNow)) {
        return true;
      }

      this.#advanceToNext();
    }

    return false;
  }

  /**
   * Helper for {@link #handleAsync}, which resolves {@link #headPromise},
   * setting {@link #headNow} or throwing whatever problem was thereby revealed.
   *
   * @throws {Error} Thrown if there was any trouble at all.
   */
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
}
