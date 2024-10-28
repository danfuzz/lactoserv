// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventPayload, EventSource } from '@this/async';
import { IntfDeconstructable, Sexp } from '@this/sexp';
import { Moment } from '@this/quant';
import { MustBe } from '@this/typey';
import { StackTrace } from '@this/valvis';

import { HumanVisitor } from '#p/HumanVisitor';
import { LogTag } from '#x/LogTag';


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
  deconstruct(forLogging_unused) {
    return new Sexp(LogPayload,
      this.#stack, this.#when, this.#tag, this.type, ...this.args);
  }

  /**
   * Gets a string representation of this instance intended for maximally-easy
   * human consumption.
   *
   * @param {boolean} [styled] Should the result be styled/colorized?
   * @param {?number} [maxWidth] The desired maximum line width to aim for
   *   (though not necessarily achieved), or `null` to have no limit.
   * @returns {string} The "human form" string.
   */
  toHuman(styled = false, maxWidth = null) {
    return HumanVisitor.payloadToHuman(this, styled, maxWidth);
  }

  /**
   * Gets a plain object representing this instance. The result has named
   * properties for each of the properties available on instances, except that
   * `stack` is omitted if `this.stack` is `null`. Everything except `.args` on
   * the result is guaranteed to be JSON-encodable, and `.args` will be
   * JSON-encodable as long as `this.args` is, since they will be the exact same
   * object.
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
}
