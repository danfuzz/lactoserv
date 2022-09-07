// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonDirective } from '#x/JsonDirective';

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

  /** @type {*} Original value being worked on. */
  #originalValue;

  /** ..... */
  #running = false;

  /** ..... */
  #workQueue = null;

  /** ..... */
  #nextQueue = null;

  /** ..... */
  #result = null;

  /** .... */
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
   * Gets an existing directive _instance_.
   *
   * @param {string} name The name of the directive.
   * @returns {JsonDirective} The directive instance.
   * @throws {Error} Thrown if there is no directive with the given name.
   */
  getDirective(name) {
    const result = this.#directives.get(name);

    if (!result) {
      throw new Error(`No such directive: ${name}`);
    }

    return result;
  }

  processSync() {
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

    const complete = (action, v) => {
      console.log('####### COMPLETE %s :: %o', action, v);
      switch (action) {
        case 'delete': {
          // Kinda weird, but...uh...okay.
          this.#result = null;
          break;
        }
        case 'resolve': {
          this.#result = v;
          break;
        }
      }
      this.#hasResult = true;
    };

    this.#running   = true;
    this.#workQueue = [];
    this.#nextQueue = [];
    this.#addToNextQueue({
      pass:  1,
      path:  [],
      value: this.#originalValue,
      complete
    });

    try {
      while (this.#nextQueue.length !== 0) {
        this.#addToWorkQueue(this.#nextQueue.shift());
        this.#drainWorkQueue();
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

  async processAsync() {
    if (this.#hasResult) {
      // Note: `#result` might be an as-yet unresolved promise, but that's okay.
      return this.#result;
    }

    const complete = (action, v) => {
      // TODO!!!
      this.#result    = v;
      this.#hasResult = true;
    };

    this.#running   = true;
    this.#workQueue = [];
    this.#nextQueue = [];
    this.#addToNextQueue({
      pass:  1,
      path:  [],
      value: this.#originalValue,
      complete
    });

    this.#result    = this.#processAsync0(); // Intentionally no `await` here!
    this.#hasResult = true;

    // Per above, `#result` is definitely an as-yet unresolved promise at this
    // point.
    return this.#result;
  }

  #addToWorkQueue(item) {
    console.log('#### Queued work item: %o', item);
    this.#workQueue.push(item);
  }

  #addToNextQueue(item) {
    if (item.pass > 10) {
      throw new Error('Expander deadlock.');
    }
    console.log('#### Queued next item: %o', item);
    this.#nextQueue.push(item);
  }

  async #processAsync0() {
    while (this.#nextQueue.length !== 0) {
      this.#addToWorkQueue(this.#nextQueue.shift());
      this.#drainWorkQueue();
    }
  }

  #drainWorkQueue() {
    while (this.#workQueue.length !== 0) {
      const item = this.#workQueue.shift();
      console.log('#### Working on: %o', item);
      this.#processWorkItem(item);
    }
  }

  #processWorkItem(item) {
    const { pass, path, value, complete } = item;
    let processedValue;

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
          throw new Error(`Unrecognised completion action: ${action}`);
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

  #processDirective(item) {
    console.log('#### processing directive: %o', item);
    const { pass, path, value, complete } = item;

    const { action, enqueue, value: result } = value.process();

    switch (action) {
      case 'again': {
        // Not resolved. Requeue for the next pass.
        if (enqueue) {
          for (const e of enqueue) {
            this.#addToNextQueue({ ...e, pass: pass + 1, path });
          }
        }
        this.#addToNextQueue({ ...item, pass: pass + 1 });
        break;
      }
      case 'delete': {
        complete('delete');
        break;
      }
      case 'resolve': {
        complete('resolve', result);
        break;
      }
      default: {
        throw new Error(`Unrecognised directive action: ${action}`);
      }
    }
  }

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
        const directive = new directiveClass(this, path, dirArg, dirValue);
        this.#addToNextQueue({
          pass: pass + 1,
          path,
          value: directive,
          complete
        });
        return directive;
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
          throw new Error(`Unrecognised completion action: ${action}`);
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
   * Performs the expansion synchronously.
   *
   * @returns {*} The result of expansion.
   * @throws {Error} Thrown if there was any trouble during expansion.
   */
  zzz_process() {
    const subProcess =
      (pass, path, value) => this.#zzz_process0(subProcess, pass, path, value);
    let value = this.#originalValue;

    for (let pass = 1; pass <= 2; pass++) {
      const result = subProcess(pass, [], value);
      if (result.replace !== undefined) {
        value = result.replace;
      } else if (result.same) {
        // Nothing to do here.
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    return value;
  }

  /**
   * Performs the expansion asynchronously.
   *
   * @returns {*} The result of expansion.
   * @throws {Error} Thrown if there was any trouble during expansion.
   */
  async zzz_processAsync() {
    // TODO!
    return this.process();
  }

  /**
   * Performs the main work of expansion.
   *
   * @param {function()} subProcess Function to call to recursively process.
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}. Will not return `{ delete }`,
   *   `{ replace...await }`, or `{ replace...outer }`.
   */
  #zzz_process0(subProcess, pass, path, value) {
    const origValue = value;
    let   result    = null;

    for (;;) {
      if ((value === null) || (typeof value !== 'object')) {
        result = { same: true };
        break;
      } else if (value instanceof Array) {
        result = this.#zzz_process0Array(subProcess, pass, path, value);
      } else {
        result = this.#zzz_process0Object(subProcess, pass, path, value);
      }

      if (result.iterate === undefined) {
        break;
      }

      if (result.await) {
        // TODO
      }
      value = result.iterate;
    }

    if (result.replace?.await) {
      // TODO
      console.log('###### promise-main at %o :: %o', path, result.replace);
      result = { replace: '<promise-placeholder-main>' };
    }

    if (result.replace !== undefined) {
      value = result.replace;
    }

    return (value === origValue) ? { same: true } : { replace: value };
  }

  /**
   * Performs the work of {@link #process0}, specifically for arrays.
   *
   * @param {function()} subProcess Function to call to recursively process.
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}, plus `{ iterate: <value>, async:
   *   <boolean> }` to help implement outer replacements. Will not return
   *   `{ delete }` or `{ replace...outer }`.
   */
  #zzz_process0Array(subProcess, pass, path, value) {
    const newValue    = [];
    let   allSame     = true;
    let   outerResult = null;

    for (let i = 0; i < value.length; i++) {
      const origValue = value[i];
      const result    = subProcess(pass, [...path, i], origValue);
      MustBe.object(result);

      if (result.delete) {
        allSame = false;
      } else if (result.replace !== undefined) {
        if (result.outer) {
          if (outerResult) {
            throw new Error('Conflicting outer replacements.');
          }
          outerResult = { iterate: result.replace, await: !!result.await };
        } else if (result.await) {
          // TODO
          console.log('###### promise-array at %o :: %o', path, result.replace);
          newValue.push('<promise-placeholder-array>');
        } else {
          newValue.push(result.replace);
        }
        allSame = false;
      } else if (result.same) {
        newValue.push(origValue);
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    if (outerResult) {
      return outerResult;
    } else {
      return allSame ? { same: true } : { replace: newValue };
    }
  }

  /**
   * Performs the work of {@link #process0}, specifically for non-array objects.
   *
   * @param {function()} subProcess Function to call to recursively process.
   * @param {number} pass Which pass is this?
   * @param {(string|number)[]} path Path within the value being worked on.
   * @param {*} value Sub-value at `path`.
   * @returns {object} Replacement for `value`, per the documentation of
   *   {@link JsonDirective.process}, plus `{ iterate: <value>, async:
   *   <boolean> }` to help implement outer replacements. Will not return
   *   `{ delete }` or `{ replace...outer }`.
   */
  #zzz_process0Object(subProcess, pass, path, value) {
    const newValue    = {};
    let   allSame     = true;
    let   outerResult = null;

    // Go over all bindings, processing them as values (ignoring directiveness).
    for (const key of Object.keys(value)) {
      const origValue = value[key];
      const result    = subProcess(pass, [...path, key], origValue);
      MustBe.object(result);

      if (result.delete) {
        allSame = false;
      } else if (result.replace !== undefined) {
        if (result.outer) {
          if (outerResult) {
            throw new Error('Conflicting outer replacements.');
          }
          outerResult = { iterate: result.replace, await: !!result.await };
        } else if (result.await) {
          // TODO
          console.log('###### promise-obj at %o :: %o', path, result.replace);
          newValue[key] = '<promise-placeholder-obj>';
        } else {
          newValue[key] = result.replace;
        }
        allSame = false;
      } else if (result.same) {
        newValue[key] = origValue;
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    if (outerResult) {
      return outerResult;
    }

    // See if the post-processing result contains any directives. If so, then
    // either run it (if there's exactly one) or complain (if there's more than
    // one).

    let directiveName = null;
    let directive     = null;

    for (const key of Object.keys(newValue)) {
      const d = this.#directives.get(key);
      if (d) {
        if (directive !== null) {
          throw new Error(`Multiple directives: ${directiveName} and ${key} (and maybe more).`);
        }
        directiveName = key;
        directive     = d;
      }
    }

    if (directive) {
      const result = directive.process(
        pass, [...path, directiveName], newValue[directiveName]);

      if (result.delete) {
        delete newValue[directiveName];
        allSame = false;
      } else if (result.replace !== undefined) {
        if (result.outer) {
          return { iterate: result.replace, await: !!result.await }
        } else if (result.await) {
          // TODO
          console.log('###### promise-dir at %o :: %o', path, result.replace);
          newValue[directiveName] = '<promise-placeholder-replacement>';
        }
        newValue[directiveName] = result.replace;
        allSame = false;
      } else if (result.same) {
        // Nothing to do here.
      } else {
        throw new Error(`Unrecognized processing result: ${util.format(result)}`);
      }
    }

    return allSame ? { same: true } : { replace: newValue };
  }
}
