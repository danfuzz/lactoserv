// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { EventPayload, EventSource } from '@this/async';
import { BaseConverter, Moment, StackTrace, Struct } from '@this/data-values';
import { Chalk } from '@this/text';
import { MustBe } from '@this/typey';

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
   *   something like a constructor class name if log records could be
   *   "invoked" (which... they kinda might be able to be at some point).
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

  /**
   * Implementation of `data-values` custom-encode protocol.
   *
   * @returns {Struct} Encoded form.
   */
  [BaseConverter.ENCODE]() {
    return new Struct(LogPayload, {
      when:  this.#when,
      tag:   this.#tag,
      stack: this.#stack,
      type:  this.type,
      args:  this.args
    });
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
   * Appends the human form of {@link #payload} to the given array of parts (to
   * ultimately `join()`).
   *
   * @param {string[]} parts Parts to append to.
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

    let first = true;
    for (const a of args) {
      if (first) {
        first = false;
      } else {
        parts.push(', ');
      }

      // TODO: Evaluate whether `util.inspect()` is sufficient.
      parts.push(util.inspect(a, LogPayload.#HUMAN_INSPECT_OPTIONS));
    }

    parts.push(colorize ? chalk.bold(')') : ')');
  }


  //
  // Static members
  //

  /**
   * Inspection options for {@link #toHumanPayload}.
   *
   * @type {object}
   */
  static #HUMAN_INSPECT_OPTIONS = Object.freeze({
    depth:       10,
    breakLength: 120,
    compact:     2,
    getters:     true
  });

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
   * @param {?LogTag} [tag] Tag to use for the instance, or `null` to use
   *   a default.
   * @param {?string} [type] Type to use for the instance, or `null` to
   *   use a default.
   * @returns {LogPayload} A minimal instance for "kickoff."
   */
  static makeKickoffInstance(tag = null, type = null) {
    tag  ??= this.#KICKOFF_TAG;
    type ??= this.#KICKOFF_TYPE;
    return new LogPayload(null, this.#KICKOFF_MOMENT, tag, type);
  }
}
