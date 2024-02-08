// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy';
import { FileServiceConfig } from '@this/sys-config';


/**
 * Helper class for services which are configured with a {@link
 * FileServiceConfig} (including subclasses).
 */
export class FileServiceHelper {
  /** @type {FileServiceConfig} The configuration. */
  #config;

  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration to use.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    this.#config = config;
    this.#logger = logger;
  }

  // TODO
}
