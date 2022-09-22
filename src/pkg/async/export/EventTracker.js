// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent } from '#x/ChainedEvent';
import { EventOrPromise } from '#p/EventOrPromise';
import { ManualPromise } from '#x/ManualPromise';
import { PromiseUtil } from '#x/PromiseUtil';

import { MustBe } from '@this/typey';


// TODO:
// * nextSync()
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

/** typedef {null|number|string|function(ChainedEvent): boolean} */
let EventPredicate;

/**
 * Event tracker, which makes it convenient to walk down a chain of {@link
 * ChainedEvent} instances. This class strictly _consumes_ events; it does not
 * produce them. This class functions approximately as an iterator over an event
 * chain, but implements much more than the basic iterator functionality.
 *
 * Several methods on this class accept a "predicate" to determine if an event
 * matches a particular criterion. These are allowed to take several forms:
 *
 * * `null` -- Matches the first event it is queried about. This is the same as
 *   specifying `0`, which is to say, it is a request for the first event on the
 *   chain that has not yet been advanced past. In the context of {@link #next},
 *   it will return this first event and then advance past it. This is the
 *   default predicate for predicate-taking methods.
 * * `count: number` -- Matches the event `count` items past the head of the
 *   event chain. Allowed to be `0`.
 * * `type: string` -- Matches an event for which `event.type === type`.
 *   **Note:** Events do not necessarily have a meaningful `type`, so this form
 *   is only useful when one knows that the events in question _do_ use `type`.
 * * `predicate: function(ChainedEvent): boolean` -- General predicate-per-se,
 *   which should return `true` for a matching event.
 *
 * **Note:** Instances of this class will be responsible for garbage
 * accumulation of event instances in the case where (a) an instance of this
 * class is not itself garbage, (b) nothing is "servicing" it, so it never
 * advances through the chain, and (c) there is a source which continues
 * emitting events on the chain.
 */
export class EventTracker {
  /** @type {EventOrPromise} Head of (first event on) the chain. */
  #head = null;

  /** @type {?Error} Error which "broke" this instance, if any. */
  #brokenReason = null;

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

    return this.#head.eventNow;
  }

  /**
   * @returns {Promise<ChainedEvent>} Promise for the -- often not-yet-known --
   * value of {@link #headNow}. This is an immediately-resolved promise in all
   * cases _except_ when either (a) this instance has yet to observe an event,
   * or (b) it is {@link #advance}d past the end of the chain.
   */
  get headPromise() {
    return this.#head.eventPromise;
  }

  /**
   * Advances this instance -- possibly zero times -- to a point where {@link
   * #headNow} is (or will necessarily become) satisfied by the given predicate.
   *
   * It is possible to use this method to advance the instance past the end of
   * the synchronously "settled" chain, in which case {@link #headNow} will
   * _synchronously_ become `null`, and the tracked source will need to emit one
   * or more events before {@link #headNow} becomes non-`null` again.
   *
   * Though this method is `async`, if the request can be satisfied
   * synchronously, it will. In such cases, the return value will still be a
   * promise (as it must be given this method is declared `async`), but
   * `#headNow` will synchronously reflect the updated state of affairs.
   *
   * **Note:** If the predicate throws an error -- even synchronously -- the
   * error becomes manifest by the state of the instance becoming broken.
   *
   * @param {EventPredicate} [predicate = null] Predicate to satisfy.
   * @returns {ChainedEvent} What {@link #headNow} is (or would have been) at
   *   the moment the operation is complete.
   * @throws {Error} Thrown if there was any trouble. If so, and the trouble was
   *   anything other than an invalid `predicate`, the instance will also become
   *   permanently broken, with most methods also throwing.
   */
  async advance(predicate = null) {
    predicate = EventTracker.#validateAndTransformPredicate(predicate);

    if (this.#brokenReason) {
      throw this.#brokenReason;
    }

    // Note: If there are any pending actions right now, they're already "baked
    // into" `#head` in that `#head.eventNow === null` and `#head.eventPromise`
    // is a promise for the result of the last (most recently) queued up action.
    // As a (desired) consequence, the call to `handleSync()` below can only
    // possibly do anything (and possibly return `true`) is when there are no
    // pending actions.
    const action = new AdvanceAction(this.#head, predicate);

    if (action.handleSync()) {
      // We synchronously found the event we were looking for, or a promise
      // for it, or we got an error. In any case, `action.resultHead` contains
      // the result, but it might be a promise. We get our `#head` to be all
      // set up to be the return value, and return the promise. Because
      // everything before this point is run _synchronously_ with respect to
      // the caller (see note at the top of the file), when the method
      // synchronously returns here, `#head` will actually be the result of
      // the completed action, even though (being `async`) the return value
      // from this method will still be a promise.
      this.#setHead(action.resultHead);
    } else {
      // Note that, even though they will resolve to the same value in the end,
      // `#head.eventPromise` is not the same promise as `action.resultPromise`,
      // and for good reason: `#setHead()` guarantees that `#headNow` is valid
      // once the action completes, but that means that there is a moment in time
      // when `action.resultPromise` is resolved but `#head.eventPromise` isn't
      // _necessarily_ resolved.
      this.#setHead(action.resultPromise);
      action.handleAsync();
    }

    return this.#head.eventPromise;
  }

  /**
   * Advances this instance -- or at least initiates it -- with the exact same
   * semantics as {@link #advance}, but (a) synchronously returns the result of
   * a synchronously-successful operation, and (b) ensures that no exception is
   * thrown asynchronously direcly from this method even if the operation
   * ultimately fails.
   *
   * Context: Even though {@link #advance} can succeed synchronously, it _might_
   * throw, and if it _does_ throw, it will be asynchronously. In such cases, a
   * _synchronous_ call to it that doesn't attempt to deal with the return value
   * will ultimately cause an unhandled promise rejection to show up at the top
   * level. Using this method ensures that that won't happen. The instance will
   * still ultimately become broken, though, which is (presumably) a desirable
   * outcome.
   *
   * @param {EventPredicate} [predicate = null] Predicate to satisfy.
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

    if (this.#head.eventNow) {
      // The `advance()` call succeeded synchronously.
      return this.#head.eventNow;
    }

    // The `advance()` call either failed synchronously or needs to do
    // asynchronous work. In either case, we now need to swallow its result, so
    // as to squelch a promise rejection, should it happen.
    PromiseUtil.handleRejection(result);

    return null;
  }

  /**
   * Advances the head of this instance with the same semantics as {@link
   * #advance}, returning the same event that {@link #advance} would have, but
   * _then_ -- after this method async-returns -- advancing past the returned
   * event (possibly past the end of the settled event chain). In the common
   * case of calling this with a default predicate, this behaves like an
   * iterator's `next()` method, "consuming" exactly one item.
   *
   * **Note:** This method async-returns after the initial advancing is done; it
   * does not wait for the final advancing over the result (because that would
   * mean this method would only return after at least one more event is
   * available). As such, if that final operation causes the instance to become
   * broken, that won't be reported until some other operation on this instance
   * is attempted. That said, there is very little that could possibly happen to
   * cause this breakage scenario. (With high confidence, it would be indicative
   * of a bug in this class.)
   *
   * @param {EventPredicate} [predicate = null] Predicate to satisfy.
   * @returns {ChainedEvent} The event just _behind_ {@link #headNow} at the
   *   the moment the operation is complete.
   * @throws {Error} Thrown if there was any trouble _before_ attempting to
   *   advance over the found event (see note above). If so, and the trouble was
   *   anything other than an invalid `predicate`, the instance will also become
   *   permanently broken, with most methods also throwing.
   */
  async next(predicate = null) {
    // Even though `advance()` does this itself, if we don't do this here and
    // the predicate is invalid, we'd end up incorrectly making the call to
    // `advanceSync()`.
    predicate = EventTracker.#validateAndTransformPredicate(predicate);

    // It is important _not_ to `await` this `advance()` call, because we need
    // to guarantee that no actions get queued up between this and the next
    // call. With an `await`, an "interstitial" action would incorrectly see the
    // result of this call (and not the next event after it) as its starting
    // point.
    const result = this.advance(predicate);

    // It is important for this to be `advanceSync()` and not `advance()`, for
    // the reason noted in the doc comment above. Most saliently, if the
    // `advance()` call above throws, then this call will too, and that means
    // that this call will be responsible for an unhandled promise rejection.
    // (And, we can't make this an async `advance()` and `await` it, because
    // that would violate the guarantee that this method promptly return a
    // matching event which happens to be the last settled one on the chain.)
    this.advanceSync(1);

    return result;
  }

  /**
   * Finds an event on the tracked chain, with the same semantics as {@link
   * #advance} except -- unlike that method -- _without_ actually advancing the
   * instance to the found event. For example, `peek()` and `peek(0)` are
   * equivalent to just accessing {@link #headPromise}.
   *
   * @param {EventPredicate} [predicate = null] Predicate to satisfy.
   * @returns {ChainedEvent} The earliest event on the tracked chain that
   *   matches `predicate`.
   * @throws {Error} Thrown if there was any trouble. Unlike {@link #advance},
   *   {@link #next}, etc., because this method does not affect the state of the
   *   instance, a thrown error here doesn't indicate that the instance is
   *   broken... yet.
   */
  async peek(predicate = null) {
    predicate = EventTracker.#validateAndTransformPredicate(predicate);

    if (this.#brokenReason) {
      throw this.#brokenReason;
    }

    const action = new AdvanceAction(this.#head, predicate);
    await action.handleAsync();
    return action.resultHead.eventNow;
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
      this.#head         = new EventOrPromise(PromiseUtil.rejectAndHandle(reason));
    }

    return reason;
  }

  /**
   * Sets {@link #head}, based on a few different possible inputs, and hooking
   * up promise resolution as appropriate.
   *
   * This method is intended never to `throw` in response to a resolution
   * problem, instead just to cause the instance to become broken. This is
   * because the method is called in contexts where throwing would inevitably
   * result in an unhandled promise rejection.
   *
   * @param {EventOrPromise|ChainedEvent|Promise<ChainedEvent>} event New head
   *   of the chain.
   * @throws {Error} Thrown if `event` is not a valid value.
   */
  #setHead(event) {
    if (this.#brokenReason) {
      // Nothing to do; already broken.
      return;
    }

    if (event instanceof EventOrPromise) {
      if (event.rejectedReason) {
        this.#becomeBroken(event.rejectedReason);
      } else {
        this.#head = event;
      }
    } else {
      this.#head = new EventOrPromise(event);
    }

    if (!this.#head.eventNow) {
      // Arrange for this instance to become broken if/when `event` resolves as
      // broken.
      (async () => {
        try {
          await this.#head.eventPromise;
        } catch (reason) {
          this.#becomeBroken(reason);
        }
      })();
    }
  }


  //
  // Static members
  //

  /**
   * Validates and appropriately-transforms a predicate as defined by {@link
   * #advance} and {@link #advanceSync}
   *
   * @param {EventPredicate} predicate Predicate to satisfy.
   * @returns {function(ChainedEvent): boolean} The validated / transformed
   *   result.
   * @throws {Error} Thrown if `predicate` is not one of the allowed forms.
   */
  static #validateAndTransformPredicate(predicate) {
    switch (typeof predicate) {
      case 'object': {
        if (predicate === null) {
          return (() => true);
        }
        break;
      }
      case 'number': {
        let count = predicate;
        if (count === 0) {
          return (() => true);
        } else if ((count > 0) && (count === Math.trunc(count))) {
          return (() => (count-- === 0));
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
 * Helper for {@link #EventTracker.advance} and related methods, which
 * implements the guts of an "advance-like" operation, without directly
 * affecting the "client" instance's state.
 */
class AdvanceAction {
  /**
   * @type {function(ChainedEvent): boolean} Predicate which an event needs to
   * satisfy, for the operation to be considered complete.
   */
  #predicate = null;

  /**
   * {?EventOrPromise} Ultimate result of this operation, if indeed it has
   * completed.
   */
  #resultHead = null;

  /**
   * {?ManualPromise} Promise which is to be sent the ultimate result of this
   * operation, if needed. This becomes non-`null` during the first access of
   * {@link #resultPromise}.
   */
  #resultMp = null;

  /**
   * @type {EventOrPromise} Event chain head from the perspective of the
   * in-progress operation.
   */
  #head;

  /**
   * Constructs an instance.
   *
   * @param {EventOrPromise} head Event chain head at which to start.
   * @param {function(ChainedEvent): boolean} predicate Predicate to satisfy.
   */
  constructor(head, predicate) {
    this.#head      = head;
    this.#predicate = predicate;
  }

  /**
   * @returns {?EventOrPromise} Ultimate result of this operation, if indeed it
   * has completed.
   */
  get resultHead() {
    return this.#resultHead;
  }

  /**
   * @returns {Promise<ChainedEvent>} Promise for the ultimate result of this
   * operation.
   */
  get resultPromise() {
    if (!this.#resultMp) {
      this.#resultMp = new ManualPromise();
    }

    return this.#resultMp.promise;
  }

  /**
   * Completes this operation -- or dies trying -- asynchronously. As with
   * {@link #handleSync}, this method does not return a value or throw an
   * error. That said, it only async-returns (with no value) after the operation
   * has completed, whether or not successfully. And after it _does_
   * async-return, {@link #resultHead} can be used to find out what the result
   * actually was.
   */
  async handleAsync() {
    while (!this.handleSync()) {
      if (this.#head.eventNow) {
        // `handleSync()` should either consume the synchronous portion of the
        // event chain or throw an error.
        throw new Error('Shouldn\'t happen.');
      }

      try {
        await this.#head.eventPromise;
      } catch (e) {
        // There is no need -- and it's counterproductive -- to pass an error to
        // `becomeDone()` here: It will find `#head.rejectedReason` and not have
        // to whip up a new rejected promise.
        this.#becomeDone();
     }
    }
  }

  /**
   * Does as much of this operation as possible synchronously.
   *
   * @returns {boolean} `true` iff the operation has been completed.
   * @throws {Error} Thrown if there was any trouble at all. And if thrown, the
   *   same error is propagated to {@link #resultPromise} if it was ever
   *   retrieved.
   */
  handleSync() {
    if (this.#resultHead) {
      return true;
    }

    try {
      while (this.#head.eventNow) {
        if (this.#predicate(this.#head.eventNow)) {
          this.#becomeDone();
          break;
        }

        this.#head = this.#head.next;
      }
    } catch (e) {
      this.#becomeDone(e);
    }

    return this.#resultHead !== null;
  }

  /**
   * Marks the operation as done, possibly due to a problem. If there is a
   * {@link #resultMp}, it is informed of the result or the problem.
   *
   * @param {?Error} error The problem, if any.
   */
  #becomeDone(error = null) {
    if (this.#resultHead) {
      // This method is only ever supposed to be called once per instance.
      throw new Error('Shouldn\'t happen.');
    }

    if (error) {
      this.#resultHead = new EventOrPromise(PromiseUtil.rejectAndHandle(error));
    } else if (this.#head.rejectedReason) {
      // When `rejectedReason !== null`, then the promise is rejected with the
      // same reason.
      error = this.#head.rejectedReason;
      this.#resultHead = this.#head;
    } else {
      this.#resultHead = this.#head;
    }

    const resultMp = this.#resultMp;
    if (resultMp && !resultMp.isSettled()) {
      if (error) {
        resultMp.rejectAndHandle(error);
      } else {
        resultMp.resolve(this.#resultHead.eventPromise);
      }
    }
  }
}
