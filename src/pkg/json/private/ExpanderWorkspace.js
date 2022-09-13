// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

import { ManualPromise } from '@this/async';
import { MustBe } from '@this/typey';

import * as util from 'node:util';

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

  /** @type {?string} Base directory for filesystem-using directives. */
  #baseDir;

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
   * only after {@link #workQueue} is drained (becomes empty).
   */
  #nextQueue = null;

  /**
   * @type {*} Final result of expansion, if known. This is always a promise
   * when this instance is run asynchronously.
   */
  #result = null;

  /** @type {boolean} Is {@link #result} known? */
  #hasResult = false;

  /**
   * Constructs an instance.
   *
   * @param {Map<string, function(new:JsonDirective)>} directives Map of
   *   directive classes.
   * @param {?string} baseDir Base directory for filesystem-using directives.
   * @param {*} value Value to be worked on.
   */
  constructor(directives, baseDir, value) {
    this.#directives = directives;
    this.#baseDir    = baseDir;

    if ((baseDir !== null) && !value?.$baseDir) {
      // No `$baseDir` in `value`. Provide the one passed in here.
      value = {
        $baseDir: baseDir,
        $value:   value
      };
    }

    this.#originalValue = value;
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

    const result   = new ManualPromise();
    const complete = (v) => {
      result.resolve(v);
    };

    this.#result    = result.promise;
    this.#hasResult = true;

    this.#expandSetup(complete);

    try {
      while (this.#drainQueuesUntilAsync()) {
        await this.#drainQueuedAwaits();
      }
    } finally {
      this.#expandCleanup();
    }

    if (!result.isSettled()) {
      // We exhausted the queue without actually completing the top-level item.
      throw new Error('Expander livelock.');
    }

    return this.#result;
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
    }

    const complete = (v) => {
      this.#result    = v;
      this.#hasResult = true;
    };

    this.#expandSetup(complete);

    try {
      if (this.#drainQueuesUntilAsync()) {
        throw new Error('Asynchronous operation required.');
      }
    } finally {
      this.#expandCleanup();
    }

    if (!this.#hasResult) {
      // We exhausted the queue without actually completing the top-level item.
      throw new Error('Expander livelock.');
    }

    return this.#result;
  }

  /**
   * Performs a "sub-expansion" asynchronously. This takes the given value and
   * expands it in a fresh workspace configured just like this one.
   *
   * @param {*} value Value to expand.
   * @param {?string} [baseDir = null] Base directory to use when expanding
   *   filesystem-based directives, or `null` to "inherit" the value from this
   *   instance (including possibly null).
   * @returns {*} The result of expansion.
   */
  async subExpandAsync(value, baseDir = null) {
    const workspace =
      new ExpanderWorkspace(this.#directives, baseDir ?? this.#baseDir, value);

    return workspace.expandAsync();
  }

  /**
   * Cleans up the instance state, after finishing an expansion (whether or not
   * successful).
   */
  #expandCleanup() {
    this.#running   = false;
    this.#workQueue = null;
    this.#nextQueue = null;
  }

  /**
   * Does initial setup just before running the expansion loop (either
   * synchronously or asynchronously).
   *
   * @param {function(*)} complete Completion function to call with the final
   *   result of expansion.
   */
  #expandSetup(complete) {
    if (this.#running) {
      // We are in a recursive call from within the expander itself. Weird case,
      // though it probably can be made to happen if one tries hard enough.
      throw new Error('Processing already in progress.');
    }

    const innerComplete = (action, v) => {
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
    this.#nextQueue.push(item);
  }

  /**
   * Adds an item to {@link #workQueue}.
   *
   * @param {{pass, path, value, complete}} item Item to add.
   */
  #addToWorkQueue(item) {
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
        this.#processQueueItem(item);
      }

      while (this.#nextQueue.length !== 0) {
        const item = this.#nextQueue.shift();
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
   * Helper for {@link #processQueueItem}, which handles a directive instance.
   *
   * @param {{pass, path, value: JsonDirective, complete}} item Item to process.
   */
  #processDirective(item) {
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
        if (result !== undefined) {
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
   * Helper for {@link #processQueueItem}, which handles a non-empty array.
   *
   * @param {{pass, path, value: *[], complete}} item Item to process.
   */
  #processNonEmptyArray(item) {
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
   * Helper for {@link #processQueueItem}, which handles a non-empty plain
   * object.
   *
   * @param {{pass, path, value: object, complete}} item Item to process.
   * @param {*[][]} entries Result of `Object.entries(value)`.
   */
  #processNonEmptyObject(item, entries) {
    const { pass, path, complete } = item;

    const result = [];
    let resultsRemaining = entries.length;

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

    for (const [key, value] of entries) {
      this.#addToWorkQueue({
        pass,
        path:     [...path, key],
        value,
        complete: (...args) => update(key, ...args)
      });
    }
  }

  /**
   * Helper for {@link #processQueueItem}, which handles a non-empty plain
   * object if it turns out to be in the form of a directive.
   *
   * @param {{pass, path, value: object, complete}} item Item to process.
   * @param {*[][]} entries Result of `Object.entries(value)`.
   * @returns {boolean} `true` if this method in fact handled the object, or
   *   `false` if not.
   * @throws {Error} Thrown if the object is a problematic directive form.
   */
  #processObjectAsDirectiveIfPossible(item, entries) {
    const { pass, path, value, complete } = item;

    const badDirectives  = [];
    const goodDirectives = [];

    for (const [key] of entries) {
      const dirClass = this.#directives.get(key);
      if (dirClass) {
        if ((entries.length === 1) || dirClass.ALLOW_EXTRA_BINDINGS) {
          // The easy cases.
          goodDirectives.push(dirClass);
        } else {
          // The hard case: The directive is good if there are no bindings other
          // than itself and any named arguments.
          let namedArgCount = 0;
          for (const name of dirClass.NAMED_ARGS) {
            if (Object.hasOwn(value, name)) {
              namedArgCount++;
            }
          }
          if (entries.length <= (namedArgCount + 1)) {
            goodDirectives.push(dirClass);
          } else {
            badDirectives.push(key);
          }
        }
      }
    }

    if (goodDirectives.length === 0) {
      if (badDirectives.length !== 0) {
        const names   = badDirectives.join(', ');
        const pathStr = util.format('%O', path);
        throw new Error(`Additional bindings not allowed for ${names} at: ${pathStr}`);
      }
      return false;
    }

    // For consistency in execution, if there are multiple good directives,
    // pick the one which is alphabetically earliest.
    const dirClass  = goodDirectives.sort((a, b) => (a.NAME < b.NAME) ? -1 : 1)[0];
    const dirName   = dirClass.NAME;
    const dirValue  = { ...value };
    const mainArg   = value[dirName];
    const namedArgs = dirClass.NAMED_ARGS;
    let   dirArg;

    // Set up `dirArg` and `dirValue`.
    delete dirValue[dirName];
    if (namedArgs.length === 0) {
      dirArg = mainArg;
    } else {
      dirArg = { $arg: mainArg };
      for (const name of namedArgs) {
        if (Object.hasOwn(dirValue, name)) {
          dirArg[name] = dirValue[name];
          delete dirValue[name];
        }
      }
    }

    const instance = new dirClass(this, path, dirArg, dirValue);
    this.#addToNextQueue({
      pass: pass + 1,
      path,
      value: instance,
      complete
    });

    return true;
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
      if (value.length === 0) {
        // Empty array: Resolve as a special case here, to avoid a lot of
        // unnecessary work and to avoid putting other special cases in the
        // code in much trickier locations.
        complete('resolve', []);
      } else {
        this.#processNonEmptyArray(item);
      }
    } else {
      const entries = Object.entries(item.value);
      if (entries.length === 0) {
        // Empty object: Resolve as a special case here; same rationale as for
        // empty arrays above.
        complete('resolve', {});
      } else if (!this.#processObjectAsDirectiveIfPossible(item, entries)) {
        this.#processNonEmptyObject(item, entries);
      }
    }
  }
}
