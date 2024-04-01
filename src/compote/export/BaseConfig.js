// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Base class for configuration representation classes. Component subclasses
 * that use configuration objects _may_ but _do not have to_ use subclasses of
 * this class for their configuration; it is meant to be an attractive but not
 * necessary choice.
 *
 * Each subclass of this class defines specific configuration bindings which are
 * to be passed to the constructor. This class makes no requirement other than
 * that the configuration passed to the constructor be a plain object.
 */
export class BaseConfig {
  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object. See class header for
   *   details.
   */
  constructor(rawConfig) {
    MustBe.plainObject(rawConfig);
  }
}
