// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { LogStackTrace } from '#x/LogStackTrace';
import { LogTag } from '#x/LogTag';

/**
 * The thing which is logged; it is the payload class for events used by this
 * module.
 */
export class LogEvent {
  /** @type {?LogStackTrace} Stack trace, if available. */
  #stack;

  /** @type {number} Moment in time. */
  #timeMsec;

  /** @type {LogTag} Tag. */
  #tag;

  /** @type {string} Payload "type." */
  #type;

  /** @type {*[]} Payload arguments. */
  #args;

  /**
   * Constructs an instance.
   *
   * @param {?LogStackTrace} stack Stack trace associated with this instance, if
   *   available.
   * @param {number} timeMsec Moment in time that this instance represents.
   * @param {LogTag} tag Tag for the instance, that is, component name and
   *   optional context.
   * @param {string} type "Type" of the instance, e.g. think of this as
   *   something like a constructor class name if log records could be
   *   "invoked" (which... they kinda might be able to be at some point).
   * @param {*[]} args Arbitrary arguments of the instance, whose meaning
   *   depends on the type.
   */
  constructor(stack, timeMsec, tag, type, args) {
    this.#stack    = stack;
    this.#timeMsec = timeMsec;
    this.#tag      = tag;
    this.#type     = type;
    this.#args     = args;
  }

  /** @type {?LogStackTrace} Stack trace, if available. */
  get stack() {
    return this.#stack;
  }

  /** @type {number} Moment in time. */
  get timeMsec() {
    return this.#timeMsec;
  }

  /** @type {LogTag} Tag. */
  get tag() {
    return this.#tag;
  }

  /** @type {string} Payload "type." */
  get type() {
    return this.#type;
  }

  /** @type {*[]} Payload arguments. */
  get args() {
    return this.#args;
  }


  //
  // Static members
  //

  /** @type {string} Type to use for "kickoff" instances. */
  static #KICKOFF_TYPE = 'kickoff';

  /** @type {LogTag} Tag to use for "kickoff" instances. */
  static #KICKOFF_TAG = new LogTag('kickoff');

  /**
   * Constructs a minimal instance of this class, suitable for use as a
   * "kickoff" event passed to an {@link EventSource}.
   *
   * @returns {LogEvent} A minimal instance for "kickoff."
   */
  static makeKickoffInstance() {
    return new LogEvent(null, 0, this.KICKOFF_TAG, this.KICKOFF_TYPE, Object.freeze([]));
  }
}
