// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { Statter } from '@this/fs-util';
import { IntfLogger } from '@this/loggy';
import { FileServiceConfig } from '@this/sys-config';
import { BaseService } from '@this/sys-framework';


/**
 * Base class for services which are configured with a {@link FileServiceConfig}
 * (including subclasses).
 */
export class BaseFileService extends BaseService {
  // Note: Default constructor is fine for this class.

  /**
   * Creates the directory of `config.path`, if it doesn't already exist.
   */
  async _prot_createDirectoryIfNecessary() {
    const { directory } = this.config.splitPath();

    if (!await Statter.directoryExists(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }
  }
}
