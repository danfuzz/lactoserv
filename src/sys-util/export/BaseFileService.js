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
    const { directory } = this._prot_splitPath();

    if (!await Statter.directoryExists(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }
  }

  /**
   * Splits `config.path` into components. The return value is a plain object
   * with the following properties:
   *
   * * `path` -- The original path (for convenience).
   * * `directory` -- The directory leading to the final path component, that
   *   is, everything but the final path component. This _not_ end with a slash,
   *   so in the case of a root-level file, this is the empty string.
   * * `fileName` -- The final path component.
   * * `filePrefix` -- The "prefix" portion of the file name, which is defined
   *   as everything up to but not including the last dot (`.`) in the name. If
   *   there is no dot in the name, then this is the same as `fileName`.
   * * `fileSuffix` -- The "suffix" portion of the file name, which is
   *   everything not included in `filePrefix`. If there is no dot in the name,
   *   then this is the empty string.
   *
   * @returns {object} The split path, as described.
   */
  _prot_splitPath() {
    const path = this.config.path;

    const { directory, fileName } =
      path.match(/^(?<directory>.*)[/](?<fileName>[^/]+)$/).groups;

    const { filePrefix, fileSuffix = '' } =
      fileName.match(/^(?<filePrefix>.*?)(?<fileSuffix>[.][^.]*)?$/).groups;

    return { path, directory, fileName, filePrefix, fileSuffix };
  }
}
