// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Standard minimal event payload.
 */
export class EventPayload {
  /** @type {string} Event "type." */
  #type;

  /** @type {*[]} Event arguments. */
  #args;

  /**
   * Constructs an instance.
   *
   * @param {string} type "Type" of the instance, e.g. think of this as
   *   something like a constructor class name if event payloads could be
   *   "invoked."
   * @param {...*} args Arbitrary arguments of the instance, whose meaning
   *   depends on the type.
   */
  constructor(type, ...args) {
    this.#type = MustBe.string(type);
    this.#args = Object.freeze([...args]);
  }

  /** @returns {*[]} Event arguments, whose meaning depends on {@link #type}. */
  get args() {
    return this.#args;
  }

  /** @returns {string} Event "type." */
  get type() {
    return this.#type;
  }


  //
  // Static members
  //

  /** @type {string} Default event type to use for "kickoff" instances. */
  static #KICKOFF_TYPE = 'kickoff';

  /**
   * Constructs a minimal instance of this class, suitable for use as the
   * payload for a "kickoff" event passed to the {@link EventSource}
   * constructor.
   *
   * @param {?string} [type] Type to use for the instance, or `null` to
   *   use a default.
   * @returns {EventPayload} A minimal instance for "kickoff."
   */
  static makeKickoffInstance(type = null) {
    type ??= this.#KICKOFF_TYPE;
    return new EventPayload(type ?? this.#KICKOFF_TYPE);
  }
}
