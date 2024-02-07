// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseApplication } from '@this/sys-framework';

import { Redirector } from '#x/Redirector';
import { SimpleResponse } from '#x/SimpleResponse';
import { StaticFiles } from '#x/StaticFiles';


/**
 * Main entrypoint of this module.
 */
export class BuiltinApplications {
  /**
   * Gets an array of all the application classes defined by this module.
   *
   * @returns {(function(new:BaseApplication))[]} Array of all application
   *   classes.
   */
  static getAll() {
    return [
      Redirector,
      SimpleResponse,
      StaticFiles
    ];
  }
}
