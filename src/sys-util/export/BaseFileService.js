// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy';
import { FileServiceConfig } from '@this/sys-config';
import { BaseService } from '@this/sys-framework';

import { FileServiceHelper } from '#x/FileServiceHelper';


/**
 * Base class for services which are configured with a {@link FileServiceConfig}
 * (including subclasses).
 */
export class BaseFileService extends BaseService {
  /** @type {FileServiceHelper} Helper instance to use. */
  #helper;

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration for this service.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#helper = new FileServiceHelper(config, logger);
  }

  /**
   * @returns {FileServiceHelper} Helper instance which uses this instance's
   * configuration and logger.
   */
  get _prot_helper() {
    return this.#helper;
  }
}
