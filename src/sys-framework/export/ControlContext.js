// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { BaseControllable } from '#x/BaseControllable';


/**
 * "Context" in which a {@link BaseControllable} is situated. Instances of this
 * class are handed to controllables via {@link BaseControllable#init}, which
 * gets called when they become hooked into a "world" (an environment that
 * contains and manages all the controllable instances).
 */
export class ControlContext {
  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /**
   * @type {?BaseControllable} Instance which represents the entire world of
   * controllable instances, or `null` if this instance's associated instance
   * _is_ the "world."
   */
  #world;

  /**
   * Constructs an instance.
   *
   * @param {BaseControllable|string} world Instance which represents the entire
   *   world of controllable instances, or the string `world` if this instance
   *   itself is to be the context of the "world" instance.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(world, logger) {
    this.#world  = (world === 'world')
      ? null
      : MustBe.instanceOf(world, BaseControllable);
    this.#logger = logger;
  }

  /** @returns {?IntfLogger} Logger to use, or `null` to not do any logging. */
  get logger() {
    return this.#logger;
  }

  /**
   * @returns {BaseControllable} Instance which represents the entire world of
   * controllable instances.
   */
  get world() {
    if (this.#world === null) {
      throw new Error('Incomplete "world" context.');
    }

    return this.#world;
  }

  /**
   * Sets up the loopback of this instance to the actual "world" object. This
   * is needed because it's impossible to name the world during its own
   * construction (due to JavaScript rules around references to `this`).
   *
   * @param {BaseControllable} world The actual "world" instance.
   */
  linkWorld(world) {
    if (this.#world !== null) {
      throw new Error('Already linked to a world.');
    } else if (world.context !== this) {
      throw new Error('Context mismatch.');
    }

    this.#world = world;
  }
}
