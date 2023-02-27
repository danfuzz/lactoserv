// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { BaseConverter, Moment, StackTrace, Struct } from '@this/data-values';
import { MustBe } from '@this/typey';

import { LogTag } from '#x/LogTag';


/**
 * The thing which is logged; it is the payload class for events used by this
 * module.
 */
export class LogRecord {
  /** @type {Moment} Moment in time that this instance represents. */
  #when;

  /** @type {LogTag} Tag. */
  #tag;

  /** @type {string} Event "type." */
  #type;

  /** @type {*[]} Event arguments. */
  #args;

  /** @type {?StackTrace} Stack trace, if available. */
  #stack;

  /**
   * Constructs an instance.
   *
   * @param {Moment} when Moment in time that this instance represents.
   * @param {LogTag} tag Tag for the instance, that is, component name and
   *   optional context.
   * @param {string} type "Type" of the instance, e.g. think of this as
   *   something like a constructor class name if log records could be
   *   "invoked" (which... they kinda might be able to be at some point).
   * @param {*[]} args Arbitrary arguments of the instance, whose meaning
   *   depends on the type.
   * @param {?StackTrace} [stack = null] Stack trace associated with this
   *   instance, if available.
   */
  constructor(when, tag, type, args, stack = null) {
    this.#when  = MustBe.instanceOf(when, Moment);
    this.#tag   = MustBe.instanceOf(tag, LogTag);
    this.#type  = MustBe.string(type);
    this.#stack = (stack === null) ? null : MustBe.instanceOf(stack, StackTrace);

    MustBe.array(args);
    if (!Object.isFrozen(args)) {
      args = Object.freeze([...args]);
    }
    this.#args = args;
  }

  /** @returns {*[]} Event arguments, whose meaning depends on {@link #type}. */
  get args() {
    return this.#args;
  }

  /** @returns {?StackTrace} Stack trace, if available. */
  get stack() {
    return this.#stack;
  }

  /** @returns {LogTag} Tag. */
  get tag() {
    return this.#tag;
  }

  /** @returns {string} Event "type." */
  get type() {
    return this.#type;
  }

  /** @returns {Moment} Moment in time that this instance represents. */
  get when() {
    return this.#when;
  }

  /**
   * Gets a string representation of this instance intended for maximally-easy
   * human consumption.
   *
   * @returns {string} The "human form" string.
   */
  toHuman() {
    const parts = [
      this.#when.toString({ decimals: 4 }),
      ' ',
      this.#tag.toHuman(true),
      ...this.#toHumanPayload()
    ];

    return parts.join('');
  }

  /**
   * Implementation of `data-values` custom-encode protocol.
   *
   * @returns {Struct} Encoded form.
   */
  [BaseConverter.ENCODE]() {
    return new Struct(LogRecord, {
      when:  this.#when,
      tag:   this.#tag,
      type:  this.#type,
      args:  this.#args,
      stack: this.#stack
    });
  }

  /**
   * Gets the human form of {@link #payload}, as an array of parts to join.
   *
   * @returns {string[]} The "human form" string parts.
   */
  #toHumanPayload() {
    const parts = [
      this.#type,
      '('
    ];

    let first = true;
    for (const a of this.#args) {
      if (first) {
        first = false;
      } else {
        parts.push(', ');
      }

      // TODO: Evaluate whether `util.inspect()` is sufficient.
      parts.push(util.inspect(a, LogRecord.#HUMAN_INSPECT_OPTIONS));
    }

    parts.push(')');

    return parts;
  }


  //
  // Static members
  //

  /** @type {object} Inspection options for {@link #toHumanPayload}. */
  static #HUMAN_INSPECT_OPTIONS = Object.freeze({
    depth:       10,
    breakLength: 120,
    compact:     2,
    getters:     true
  });

  /** @type {Moment} Moment to use for "kickoff" instances. */
  static #KICKOFF_MOMENT = new Moment(0);

  /** @type {string} Default event type to use for "kickoff" instances. */
  static #KICKOFF_TYPE = 'kickoff';

  /** @type {LogTag} Default tag to use for "kickoff" instances. */
  static #KICKOFF_TAG = new LogTag('kickoff');

  /**
   * Constructs a minimal instance of this class, suitable for use as the
   * payload for a "kickoff" event passed to the {@link EventSource}
   * constructor.
   *
   * @param {?LogTag} [tag = null] Tag to use for the instance, or `null` to use
   *   a default.
   * @param {?string} [type = null] Type to use for the instance, or `null` to
   *   use a default.
   * @returns {LogRecord} A minimal instance for "kickoff."
   */
  static makeKickoffInstance(tag = null, type = null) {
    tag  ??= this.#KICKOFF_TAG;
    type ??= this.#KICKOFF_TYPE;
    return new LogRecord(this.#KICKOFF_MOMENT, tag, type, Object.freeze([]));
  }
}
