// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';

import { BaseFilePreserver } from '#p/BaseFilePreserver';
import { BaseFileService } from '#x/BaseFileService';


/**
 * Configurable file "saver" (preserver) for keeping old files around.
 */
export class Saver extends BaseFilePreserver {
  /**
   * Constructs an instance.
   *
   * @param {BaseFileService.Config} config Configuration to use.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);
  }

  /** @override */
  async _impl_doWork() {
    // Nothing to do here.
  }

  /** @override */
  _impl_whenWorkRequired() {
    // This class never interrupts the runner.
    return null;
  }
}
