// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

import { Condition } from '@this/async';
import { MustBe } from '@this/typey';

/**
 * Workspace for running an expansion set up by {@link JsonExpander}, including
 * code to do most of the work (other than what's defined by most directives).
 */
export class ExpanderWorkspace {
  /**
   * @type {Map<string, function(new:JsonDirective)>} Map from names to
   * corresponding directive-handler classes, for all directives recognized by
   * this instance.
   */
  #directives = new Map();

  /** @type {*} Original value being worked on. */
  #originalValue;

  /** @type {boolean} Is expansion currently in-progress? */
  #running = false;

  /**
   * @type {?{pass, path, value, complete}[]} Items in need of processing. These
   * are handled in FIFO order.
   */
  #workQueue = null;

  /**
   * @type {?{pass, path, value, complete}[]} Items in need of processing, but
   * only after {@link #workQueue} is drained (becomes empty). Elements from
   * this queue get added one at a time to {@link #workQueue}, in between which
   * {@link #workQueue} gets drained.
   */
  #nextQueue = null;

  /**
   * @type {*} Final result of expansion, if known. "Known" takes the form of a
   * promise when this instance is run asynchronously.
   */
  #result = null;

  /** @type {boolean} Is {@link #result} known? */
  #hasResult = false;

  /**
   * Constructs an instance.
   *
   * @param {Map<string, function(new:JsonDirective)>} directives Map of
   *   directive classes.
   * @param {*} value Value to be worked on.
   */
  constructor(directives, value) {
    this.#directives    = directives;
    this.#originalValue = value;
  }

  /**
   * Adds a directive _instance_.
   *
   * @param {string} name The name of the directive.
   * @param {JsonDirective} directive The directive instance.
   */
  addDirective(name, directive) {
    this.#directives.set(name, directive);
  }

  /**
   * Perform expansion asynchronously.
   *
   * @returns {*} The result of expansion.
   * @throws {Error} Thrown if there was any trouble during expansion.
   */
  async expandAsync() {
    if (this.#hasResult) {
      // Note: `#result` might be an as-yet unresolved promise, but that's okay.
      return this.#result;
    }

    this.#result    = this.#expandAsync0(); // Intentionally no `await` here!
    this.#hasResult = true;

    // Per above, `#result` is definitely an as-yet unresolved promise at this
    // point.
    return this.#result;
  }

  /**
   * Perform the main part of expansion, asynchronously.
   *
   * @returns {*} The result of expansion.
   * @throws {Error} Thrown if there was any trouble during expansion.
   */
  async #expandAsync0() {
    const completed = new Condition();
    let result = null;

    const complete = (v) => {
      console.log('####### ASYNC COMPLETE %o', v);
      result = v;
      completed.value = true;
    };

    this.#expandSetup(complete);

    try {
      while (this.#drainQueuesUntilAsync()) {
        await this.#drainQueuedAwaits();
      }
    } finally {
      // Don't leave the instance in a weird state; reset it.
      this.#running   = false;
      this.#workQueue = null;
      this.#nextQueue = null;
    }

    await completed.whenTrue();
    return result;
  }

  /**
   * Perform expansion asynchronously.
   *
   * @returns {*} The result of expansion.
   * @throws {Error} Thrown if there was any trouble during expansion.
   */
  expandSync() {
    if (this.#hasResult) {
      // Note: In the unusual case where `processAsync()` has already been
      // called but hasn't completed, `#result` will be an as-yet unresolved
      // promise.
      return this.#result;
    } else if (this.#running) {
      // We are in a recursive call from within the expander itself. Weird case,
      // _maybe_ can't actually happen?
      throw new Error('Processing already in progress.');
    }

    const complete = (v) => {
      console.log('####### SYNC COMPLETE %o', v);
      this.#result    = v;
      this.#hasResult = true;
    };

    this.#expandSetup(complete);

    try {
      if (this.#drainQueuesUntilAsync()) {
        throw new Error('Asynchronous operation required.');
      }
    } finally {
      // Don't leave the instance in a weird state; reset it.
      this.#running   = false;
      this.#workQueue = null;
      this.#nextQueue = null;
    }

    if (!this.#hasResult) {
      // We exhausted the queue without actually completing the top-level item.
      throw new Error('Expander livelock.');
    }

    return this.#result;
  }

  #expandSetup(complete) {
    const innerComplete = (action, v) => {
      console.log('####### COMPLETE %s :: %o', action, v);
      switch (action) {
        case 'delete': {
          // Kinda weird, but...uh...okay.
          v = null;
          break;
        }
        case 'resolve': {
          // Nothing to do here.
          break;
        }
        default: {
          throw new Error(`Unrecognized completion action: ${action}`);
        }
      }
      complete(v);
    };

    this.#running   = true;
    this.#workQueue = [];
    this.#nextQueue = [];

    this.#addToWorkQueue({
      pass:     1,
      path:     [],
      value:    this.#originalValue,
      complete: innerComplete
    });
  }

  /**
   * Adds an item to {@link #nextQueue}.
   *
   * @param {{pass, path, value, complete}} item Item to add.
   */
  #addToNextQueue(item) {
    if (item.pass > 10) {
      throw new Error('Expander deadlock.');
    }
    //console.log('#### Queued next item: %o', item);
    this.#nextQueue.push(item);
  }

  /**
   * Adds an item to {@link #workQueue}.
   *
   * @param {{pass, path, value, complete}} item Item to add.
   */
  #addToWorkQueue(item) {
    //console.log('#### Queued work item: %o', item);
    this.#workQueue.push(item);
  }

  /**
   * Drains all `awaits` at the front of `#nextQueue`.
   */
  async #drainQueuedAwaits() {
    while (this.#nextQueue.length !== 0) {
      const item = this.#nextQueue[0];

      if (!item.await) {
        break;
      }

      this.#nextQueue.shift();

      console.log('#### Waiting on: %o', item.path);
      const result = await item.value;
      item.complete('resolve', result);
    }
  }

  /**
   * Drains both queues, until only `await` items remain. Specifically, this
   * processes `#workQueue` completely, then adds a single non-`await` item from
   * `#nextQueue`, and iterates. Once all that remains in `#nextQueue` are
   * `await` items, this method returns.
   *
   * @returns {boolean} Whether (`true`) or not (`false`) any `await` items
   *   remain to be processed.
   */
  #drainQueuesUntilAsync() {
    const awaitItems = [];

    outer:
    for (;;) {
      while (this.#workQueue.length !== 0) {
        const item = this.#workQueue.shift();
        console.log('#### Working on: %o', item.path);
        this.#processQueueItem(item);
      }

      while (this.#nextQueue.length !== 0) {
        const item = this.#nextQueue.shift();
        console.log('#### Next item: %o', item.path);
        if (item.await) {
          awaitItems.push(item);
        } else {
          this.#workQueue.push(item);
          continue outer;
        }
      }

      break;
    }

    // All that remains are items to `await` (possibly none).
    if (awaitItems.length === 0) {
      return false;
    } else {
      this.#nextQueue.push(...awaitItems);
      return true;
    }
  }

  /**
   * Helper for {@link #processQueueItem}, which handles an array.
   *
   * @param {{pass, path, value: *[], complete}} item Item to process.
   */
  #processArray(item) {
    const { pass, path, value, complete } = item;
    const result = [];
    const deletions = [];
    let resultsRemaining = value.length;

    const update = (idx, action, arg) => {
      switch (action) {
        case 'delete': {
          deletions.push(idx);
          break;
        }
        case 'resolve': {
          result[idx] = arg;
          break;
        }
        default: {
          throw new Error(`Unrecognized completion action: ${action}`);
        }
      }

      if (--resultsRemaining === 0) {
        deletions.sort();
        while (deletions.length !== 0) {
          result.splice(deletions.pop(), 1);
        }
        complete('resolve', result);
      }
    };

    for (let index = 0; index < value.length; index++) {
      this.#addToWorkQueue({
        pass,
        path:     [...path, index],
        value:    value[index],
        complete: (...args) => update(index, ...args)
      });
    }
  }

  /**
   * Helper for {@link #processQueueItem}, which handles a directive instance.
   *
   * @param {{pass, path, value: JsonDirective, complete}} item Item to process.
   */
  #processDirective(item) {
    //console.log('#### processing directive: %o', item);
    const { pass, path, value, complete } = item;

    const { action, await: isAwait, enqueue, value: result } = value.process();

    switch (action) {
      case 'again': {
        // Not resolved. Requeue for the next pass.
        if (enqueue) {
          for (const e of enqueue) {
            MustBe.arrayOfIndex(e.path);
            MustBe.function(e.complete);
            this.#addToNextQueue({
              pass:     pass + 1,
              path:     [...path, ...e.path],
              value:    e.value,
              complete: e.complete
            });
          }
        }
        if (result) {
          console.log('#### DIRECTIVE SELF-REPLACED: %o :: %o', path, result);
          this.#addToNextQueue({
            ...item,
            pass:  pass + 1,
            value: result
          });
        } else {
          this.#addToNextQueue({
            ...item,
            pass: pass + 1
          });
        }
        break;
      }
      case 'delete': {
        complete('delete');
        break;
      }
      case 'resolve': {
        if (isAwait) {
          console.log('##### QUEUED AWAIT %o :: %o', path, result);
          this.#addToNextQueue({
            ...item,
            pass:  pass + 1,
            value: result,
            await: true
          });
        } else {
          complete('resolve', result);
        }
        break;
      }
      default: {
        throw new Error(`Unrecognized directive action: ${action}`);
      }
    }
  }

  /**
   * Helper for {@link #processQueueItem}, which handles a plain object.
   *
   * @param {{pass, path, value: object, complete}} item Item to process.
   */
  #processObject(item) {
    const { pass, path, value, complete } = item;
    const keys = Object.keys(value).sort();

    // If there is a directive key, convert the element to a directive, and
    // queue it up for the next pass.
    for (const k of keys) {
      const directiveClass = this.#directives.get(k);
      if (directiveClass) {
        const dirArg   = value[k];
        const dirValue = { ...value };
        delete dirValue[k];
        console.log('### DIRECTIVE %s at %o', k, path);
        const directive = new directiveClass(this, path, dirArg, dirValue);
        this.#addToNextQueue({
          pass: pass + 1,
          path,
          value: directive,
          complete
        });
        return; // Don't _also_ queue up a regular object expansion.
      }
    }

    // No directive; just queue up all bindings for regular conversion.

    const result = [];
    let resultsRemaining = keys.length;

    const update = (key, action, arg) => {
      switch (action) {
        case 'delete': {
          // No need to do anything for this case.
          break;
        }
        case 'resolve': {
          result.push([key, arg]);
          break;
        }
        default: {
          throw new Error(`Unrecognized completion action: ${action}`);
        }
      }

      if (--resultsRemaining === 0) {
        // Sort by key, for more consistent results.
        result.sort((a, b) => (a[0] < b[0]) ? -1 : 1);
        complete('resolve', Object.fromEntries(result));
      }
    };

    for (const k of keys) {
      this.#addToWorkQueue({
        pass,
        path:     [...path, k],
        value:    value[k],
        complete: (...args) => update(k, ...args)
      });
    }
  }

  /**
   * Processes an item which had been placed on {@link #workQueue}.
   *
   * @param {{pass, path, value: *, complete}} item Item to process.
   */
  #processQueueItem(item) {
    const { value, complete } = item;

    if ((value === null) || (typeof value !== 'object')) {
      complete('resolve', value);
    } else if (value instanceof JsonDirective) {
      this.#processDirective(item);
    } else if (value instanceof Array) {
      this.#processArray(item);
    } else {
      this.#processObject(item);
    }
  }
}
