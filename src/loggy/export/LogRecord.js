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
  /**
   * @type {number} Moment in time, as Unix Epoch seconds, with precision
   * expected to be microseconds or better.
   */
  #atSecs;

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
   * @param {number} atSecs Moment in time that this instance represents, as
   *   seconds since the start of the Unix Epoch, with precision expected to be
   *   microseconds or better.
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
  constructor(atSecs, tag, type, args, stack = null) {
    this.#atSecs = MustBe.number(atSecs);
    this.#tag    = MustBe.instanceOf(tag, LogTag);
    this.#type   = MustBe.string(type);
    this.#stack  = (stack === null) ? null : MustBe.instanceOf(stack, StackTrace);

    MustBe.array(args);
    if (!Object.isFrozen(args)) {
      args = Object.freeze([...args]);
    }
    this.#args = args;
  }

  /**
   * @returns {number} Moment in time that this instance represents, as seconds
   * since the start of the Unix Epoch, with precision expected to be
   * microseconds or better.
   */
  get atSecs() {
    return this.#atSecs;
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

  /** @returns {*[]} Event arguments, whose meaning depends on {@link #type}. */
  get args() {
    return this.#args;
  }

  /**
   * Gets a string representation of this instance intended for maximally-easy
   * human consumption.
   *
   * @returns {string} The "human form" string.
   */
  toHuman() {
    const parts = [
      Moment.stringFromSecs(this.#atSecs, { decimals: 4 }),
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
      atSecs: this.#atSecs,
      tag:    this.#tag,
      type:   this.#type,
      args:   this.#args,
      stack:  this.#stack
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
    return new LogRecord(0, tag, type, Object.freeze([]));
  }
}
