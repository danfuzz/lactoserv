// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { EventPayload, EventSource } from '@this/async';
import { IntfDeconstructable } from '@this/decon';
import { Moment } from '@this/quant';
import { Chalk } from '@this/text';
import { MustBe } from '@this/typey';
import { BaseDefRef, StackTrace, VisitDef } from '@this/valvis';

import { LogTag } from '#x/LogTag';


/**
 * Always-on `Chalk` instance.
 *
 * @type {Chalk}
 */
const chalk = Chalk.ON;

/**
 * The thing which is logged; it is the payload class used for events
 * constructed by this module. It includes the same basic event properties as
 * {@link EventPayload} (which it inherits from), to which it adds a few
 * logging-specific properties.
 *
 * @implements {IntfDeconstructable}
 */
export class LogPayload extends EventPayload {
  /**
   * Stack trace, if available.
   *
   * @type {?StackTrace}
   */
  #stack;

  /**
   * Moment in time that this instance represents.
   *
   * @type {Moment}
   */
  #when;

  /**
   * Tag.
   *
   * @type {LogTag}
   */
  #tag;

  /**
   * Constructs an instance.
   *
   * @param {?StackTrace} stack Stack trace associated with this instance, or
   *   `null` if not available.
   * @param {Moment} when Moment in time that this instance represents.
   * @param {LogTag} tag Tag for the instance, that is, component name and
   *   optional context.
   * @param {string} type "Type" of the instance, e.g. think of this as
   *   something like a constructor class name if log records could be "invoked"
   *   (which... they kinda might be able to be at some point).
   * @param {...*} args Arbitrary arguments of the instance, whose meaning
   *   depends on the type.
   */
  constructor(stack, when, tag, type, ...args) {
    super(type, ...args);

    this.#stack = (stack === null) ? null : MustBe.instanceOf(stack, StackTrace);
    this.#when  = MustBe.instanceOf(when, Moment);
    this.#tag   = MustBe.instanceOf(tag, LogTag);
  }

  /** @returns {?StackTrace} Stack trace, if available. */
  get stack() {
    return this.#stack;
  }

  /** @returns {LogTag} Tag. */
  get tag() {
    return this.#tag;
  }

  /** @returns {Moment} Moment in time that this instance represents. */
  get when() {
    return this.#when;
  }

  /** @override */
  deconstruct() {
    return [LogPayload,
      this.#stack, this.#when, this.#tag, this.type, ...this.args];
  }

  /**
   * Gets a string representation of this instance intended for maximally-easy
   * human consumption.
   *
   * @param {boolean} [colorize] Colorize the result?
   * @returns {string} The "human form" string.
   */
  toHuman(colorize = false) {
    const whenString = this.#when.toString({ decimals: 4 });

    const parts = [
      colorize ? chalk.bold.blue(whenString) : whenString,
      ' ',
      this.#tag.toHuman(colorize),
      ' '
    ];

    this.#appendHumanPayload(parts, colorize);

    return parts.join('');
  }

  /**
   * Gets a plain object representing this instance. The result has named
   * properties for each of the properties available on instances, except that
   * `stack` is omitted if `this.stack` is `null`. Everything except `.args` on
   * the result is guaranteed to be JSON-encodable, and `.args` will be
   * JSON-encodable as long as `this.args` is, since they will be the exact
   * same object.
   *
   * @returns {object} The plain object representation of this instance.
   */
  toPlainObject() {
    return {
      ...(this.#stack ? { stack: this.#stack.frames } : {}),
      when: this.#when.toPlainObject(),
      tag:  this.#tag.allParts,
      type: this.type,
      args: this.args
    };
  }

  /**
   * Appends the human form of {@link #payload} to the given array of parts (to
   * ultimately `join()`).
   *
   * @param {Array<string>} parts Parts to append to.
   * @param {boolean} colorize Colorize the result?
   */
  #appendHumanPayload(parts, colorize) {
    const args = this.args;

    if (args.length === 0) {
      // Avoid extra work in the easy zero-args case.
      const text = `${this.type}()`;
      parts.push(colorize ? chalk.bold(text) : text);
      return;
    }

    const opener = `${this.type}(`;

    parts.push(colorize ? chalk.bold(opener) : opener);
    LogPayload.#appendHumanValue(parts, args, true);

    parts.push(colorize ? chalk.bold(')') : ')');
  }


  //
  // Static members
  //

  /**
   * Moment to use for "kickoff" instances.
   *
   * @type {Moment}
   */
  static #KICKOFF_MOMENT = new Moment(0);

  /**
   * Default event type to use for "kickoff" instances.
   *
   * @type {string}
   */
  static #KICKOFF_TYPE = 'kickoff';

  /**
   * Default tag to use for "kickoff" instances.
   *
   * @type {LogTag}
   */
  static #KICKOFF_TAG = new LogTag('kickoff');

  /**
   * Constructs a minimal instance of this class, suitable for use as the
   * payload for a "kickoff" event passed to the {@link EventSource}
   * constructor.
   *
   * @param {?LogTag} [tag] Tag to use for the instance, or `null` to use a
   *   default.
   * @param {?string} [type] Type to use for the instance, or `null` to use a
   *   default.
   * @returns {LogPayload} A minimal instance for "kickoff."
   */
  static makeKickoffInstance(tag = null, type = null) {
    tag  ??= this.#KICKOFF_TAG;
    type ??= this.#KICKOFF_TYPE;
    return new LogPayload(null, this.#KICKOFF_MOMENT, tag, type);
  }

  /**
   * Helper for {@link #appendHumanValue}, which deals with objects and arrays.
   *
   * TODO: Figure out when doing a multi-line rendering would be more ergonomic.
   *
   * @param {Array<string>} parts Parts array to append to.
   * @param {*} value Value to represent.
   * @param {boolean} skipBrackets Skip brackets at this level?
   */
  static #appendHumanAggregate(parts, value, skipBrackets) {
    const entries  = Object.entries(value);
    const isArray  = Array.isArray(value);
    const brackets = (() => {
      if (skipBrackets) return { open: '',   close: '',   empty: ''   };
      else if (isArray) return { open: '[',  close: ']',  empty: '[]' };
      else              return { open: '{ ', close: ' }', empty: '{}' };
    })();

    if (entries.length === 0) {
      parts.push(brackets.empty);
      return;
    }

    parts.push(brackets.open);

    let first   = true;
    let inProps = !isArray;

    for (const [k, v] of entries) {
      if ((k === 'length') && !inProps) {
        inProps = true;
        continue;
      }

      if (first) {
        first = false;
      } else {
        parts.push(', ');
      }

      if (inProps) {
        if ((typeof k === 'string') && /^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test(k)) {
          parts.push(k);
        } else {
          parts.push(util.inspect(k)); // So it's quoted.
        }
        parts.push(': ');
      }

      this.#appendHumanValue(parts, v);
    }

    parts.push(brackets.close);
  }

  /**
   * Appends strings to an array of parts to represent the given value in
   * "human" form. This is akin to `util.inspect()`, though by no means
   * identical.
   *
   * TODO: Deal with shared refs.
   *
   * @param {Array<string>} parts Parts array to append to.
   * @param {*} value Value to represent.
   * @param {boolean} [skipBrackets] Skip brackets at this level? This is
   *   passed as `true` for the very top-level call to this method.
   */
  static #appendHumanValue(parts, value, skipBrackets = false) {
    switch (typeof value) {
      case 'object': {
        if (value === null) {
          parts.push('null');
        } else if (value instanceof BaseDefRef) {
          parts.push(`#${value.index}`);
          if (value instanceof VisitDef) {
            parts.push(' = ');
            this.#appendHumanValue(parts, value.value);
          }
        } else {
          this.#appendHumanAggregate(parts, value, skipBrackets);
        }
        break;
      }

      default: {
        // TODO: Evaluate whether `util.inspect()` is sufficient.
        parts.push(util.inspect(value));
      }
    }
  }
}
