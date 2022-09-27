// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { LogStackTrace } from '#x/LogStackTrace';
import { LogTag } from '#x/LogTag';

import { MustBe } from '@this/typey';

import * as util from 'node:util';


/**
 * The thing which is logged; it is the payload class for events used by this
 * module.
 */
export class LogRecord {
  /** @type {?LogStackTrace} Stack trace, if available. */
  #stack;

  /**
   * @type {number} Moment in time, as Unix Epoch seconds, with precision
   * expected to be microseconds or better.
   */
  #timeSec;

  /** @type {LogTag} Tag. */
  #tag;

  /** @type {string} Event "type." */
  #type;

  /** @type {*[]} Event arguments. */
  #args;

  /**
   * Constructs an instance.
   *
   * @param {?LogStackTrace} stack Stack trace associated with this instance, if
   *   available.
   * @param {number} timeSec Moment in time that this instance represents, as
   *   seconds since the start of the Unix Epoch, with precision expected to be
   *   microseconds or better.
   * @param {LogTag} tag Tag for the instance, that is, component name and
   *   optional context.
   * @param {string} type "Type" of the instance, e.g. think of this as
   *   something like a constructor class name if log records could be
   *   "invoked" (which... they kinda might be able to be at some point).
   * @param {*[]} args Arbitrary arguments of the instance, whose meaning
   *   depends on the type.
   */
  constructor(stack, timeSec, tag, type, args) {
    this.#stack   = stack;
    this.#timeSec = MustBe.number(timeSec);
    this.#tag     = MustBe.object(tag, LogTag);
    this.#type    = MustBe.string(type);
    this.#args    = MustBe.array(args);
  }

  /** @type {?LogStackTrace} Stack trace, if available. */
  get stack() {
    return this.#stack;
  }

  /**
   * @type {number} Moment in time that this instance represents, as seconds
   * since the start of the Unix Epoch, with precision expected to be
   * microseconds or better.
   */
  get timeSec() {
    return this.#timeSec;
  }

  /** @type {LogTag} Tag. */
  get tag() {
    return this.#tag;
  }

  /** @type {string} Event "type." */
  get type() {
    return this.#type;
  }

  /** @type {*[]} Event arguments, whose meaning depends on {@link #type}. */
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
      ...this.#toHumanTime(),
      ' ',
      this.#tag.toHuman(),
      ' ',
      ...this.#toHumanPayload()
    ];

    return parts.join('');
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
      parts.push(util.inspect(a, LogRecord.HUMAN_INSPECT_OPTIONS));
    }

    parts.push(')');

    return parts;
  }

  /**
   * Gets the "human form" of the time string, as an array of parts to join.
   *
   * @returns {string[]} The "human form" string parts.
   */
  #toHumanTime() {
    const frac = this.#timeSec - (this.#timeSec % 1);
    const d    = new Date(this.#timeSec);

    return [
      d.getUTCFullYear().toString(),
      (d.getUTCMonth() + 1).toString().padStart(2, '0'),
      d.getUTCDate().toString().padStart(2, '0'),
      '-',
      d.getUTCHours().toString().padStart(2, '0'),
      d.getUTCMinutes().toString().padStart(2, '0'),
      d.getUTCSeconds().toString().padStart(2, '0'),
      '.',
      frac.toFixed(6).slice(2)
    ];
  }

  //
  // Static members
  //

  /** @type {object} Inspection options for {@link #toHumanPayload}. */
  static #HUMAN_INSPECT_OPTIONS = Object.freeze({
    depth:       10,
    breakLength: Number.POSITIVE_INFINITY,
    compact:     8,
    getters:     true
  });

  /** @type {string} Default type to use for "kickoff" instances. */
  static #KICKOFF_TYPE = 'kickoff';

  /** @type {LogTag} Default tag to use for "kickoff" instances. */
  static #KICKOFF_TAG = new LogTag('kickoff');

  /**
   * Constructs a minimal instance of this class, suitable for use as a
   * "kickoff" event payload passed to an {@link EventSource}.
   *
   * @param {?LogTag} [tag = null] Tag to use for the instance, or `null` to use
   *   a default.
   * @param {?string} [type = null] Type to use for the instance, or `null` to
   *   use a default.
   * @returns {LogRecord} A minimal instance for "kickoff."
   */
  static makeKickoffInstance(tag = null, type = null) {
    tag  ??= this.KICKOFF_TAG;
    type ??= this.KICKOFF_TYPE;
    return new LogRecord(null, 0, tag, type, Object.freeze([]));
  }
}
