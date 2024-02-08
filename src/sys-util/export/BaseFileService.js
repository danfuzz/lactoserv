// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { Statter } from '@this/fs-util';
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
    const { directory } = this.config.pathParts;

    if (!await Statter.directoryExists(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }
  }

  /**
   * "Touches" (creates if necessary) the file at {@link #path}.
   */
  async _prot_touchPath() {
    const path = this.config.path;

    if (await Statter.pathExists(path)) {
      // File already exists; just update the modification time.
      const dateNow = new Date();
      await fs.utimes(path, dateNow, dateNow);
    } else {
      await fs.appendFile(path, '');
    }
  }
}
